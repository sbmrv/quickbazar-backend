import { AppError } from '../../utils/AppError.js';
import { writeAudit } from '../audit/service.js';
import { restockLine, settleLine } from '../cart/service.js';
import { notifyUser } from '../notifications/service.js';
import { Order } from '../orders/model.js';
import { Seller } from '../sellers/model.js';
import { emitRoom } from '../../sockets/hub.js';
import { canTransition, deriveOrderStatus } from './machine.js';
import { Shipment } from '../orders/model.js';

/**
 * @param {Record<string, any>} shipment
 * @param {'buyer' | 'seller' | 'admin'} audience
 */
export function toShipmentView(shipment, audience) {
  const ready = ['READY_FOR_PICKUP', 'PICKED_UP', 'ARRIVED', 'DELIVERED'].includes(shipment.status);
  return {
    id: String(shipment._id),
    orderId: String(shipment.orderId),
    shipmentNumber: shipment.shipmentNumber,
    storeId: String(shipment.storeId),
    sellerId: String(shipment.sellerId),
    status: shipment.status,
    deliveryMode: shipment.deliveryMode,
    etaMinutesPromised: shipment.etaMinutesPromised,
    distanceKm: shipment.distanceKm,
    items: shipment.items,
    fees: shipment.fees,
    timeline: shipment.timeline ?? [],
    cancelReason: shipment.cancelReason ?? '',
    pickupCode: (audience === 'seller' || audience === 'admin') && ready ? shipment.pickupCode : undefined,
    deliveryOtp: audience === 'buyer' || audience === 'admin' ? shipment.deliveryOtp : undefined,
    deliveredAt: shipment.deliveredAt ?? null,
  };
}

async function syncOrder(orderId) {
  const shipments = await Shipment.find({ orderId }).select('status').lean();
  const status = deriveOrderStatus(shipments.map((row) => row.status));
  await Order.updateOne({ _id: orderId }, { status });
  return status;
}

/**
 * @param {Record<string, any>} shipment
 */
async function broadcast(shipment, title, body) {
  const payload = {
    shipmentId: String(shipment._id),
    orderId: String(shipment.orderId),
    storeId: String(shipment.storeId),
    status: shipment.status,
  };
  emitRoom(`store:${shipment.storeId}`, 'shipment:status', payload);
  emitRoom(`shipment:${shipment._id}`, 'shipment:status', payload);
  emitRoom(`user:${shipment.buyerId}`, 'shipment:status', payload);
  emitRoom('admin:ops', 'shipment:status', payload);
  await notifyUser(shipment.buyerId, { title, body, refType: 'shipment', refId: String(shipment._id) });
}

/**
 * @param {import('mongoose').Document} shipment
 * @param {string} to
 * @param {'seller' | 'buyer' | 'admin' | 'system'} actor
 * @param {string} by
 * @param {string} [note]
 */
export async function transitionShipment(shipment, to, actor, by, note = '') {
  if (!canTransition(shipment.status, to, actor)) {
    throw new AppError('ILLEGAL_TRANSITION', `Cannot move this shipment from ${shipment.status} to ${to}.`, 409);
  }
  const previous = shipment.status;
  shipment.status = to;
  shipment.timeline.push({ status: to, at: new Date(), by, note });
  if (to === 'REJECTED' || to === 'CANCELLED') shipment.cancelReason = note;
  if (to === 'DELIVERED') shipment.deliveredAt = new Date();
  await shipment.save();

  const restockFrom = ['PLACED', 'ACCEPTED', 'PACKING', 'PAYMENT_PENDING'];
  if ((to === 'REJECTED' || to === 'CANCELLED') && restockFrom.includes(previous)) {
    for (const item of shipment.items) {
      await restockLine(null, { productId: item.productId, sku: item.sku, qty: item.qty });
    }
  }
  if (to === 'DELIVERED') {
    for (const item of shipment.items) {
      await settleLine({ productId: item.productId, sku: item.sku, qty: item.qty });
    }
  }
  await syncOrder(shipment.orderId);
  await broadcast(shipment, `Order ${to.toLowerCase()}`, note || `Shipment is now ${to}.`);
  if (to === 'PLACED') {
    emitRoom(`store:${shipment.storeId}`, 'shipment:new', {
      shipmentId: String(shipment._id),
      orderId: String(shipment.orderId),
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
    });
    const { getSetting } = await import('../settings/service.js');
    const { scheduleSellerAccept } = await import('../../jobs/sellerAccept.js');
    const sellerSetting = await getSetting('seller');
    const seller = await Seller.findById(shipment.sellerId).select('userId').lean();
    if (seller) {
      await notifyUser(seller.userId, { title: 'New order', body: shipment.shipmentNumber, refType: 'shipment', refId: String(shipment._id) });
    }
    await scheduleSellerAccept(String(shipment._id), sellerSetting.acceptTimeoutSec).catch(() => {});
  }
  if (to === 'ACCEPTED') {
    const { enqueueAssignment } = await import('../../jobs/assignment.js');
    await enqueueAssignment(String(shipment._id)).catch(() => {});
  }
  if (to === 'REJECTED' || to === 'CANCELLED' || to === 'RETURNED') {
    const { refundIfPaid } = await import('../payments/service.js');
    const { reverseDeliveryLedger } = await import('../ledger/service.js');
    if (previous === 'DELIVERED' || to === 'RETURNED') await reverseDeliveryLedger(shipment);
    await refundIfPaid(String(shipment.orderId), note || to).catch(() => {});
  }
  if (to === 'DELIVERED') {
    const { postDeliveryLedger } = await import('../ledger/service.js');
    await postDeliveryLedger(shipment).catch(() => {});
  }
  return shipment;
}

/**
 * @param {string} shipmentId
 */
export async function timeoutReject(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment || shipment.status !== 'PLACED') return;
  await transitionShipment(shipment, 'REJECTED', 'system', 'system', 'Seller did not accept in time');
}

/**
 * @param {string} sellerUserId
 */
export async function listSellerShipments(sellerUserId) {
  const seller = await Seller.findOne({ userId: sellerUserId, status: 'approved' }).lean();
  if (!seller) throw new AppError('SELLER_REQUIRED', 'Apply to sell before continuing.', 403);
  const rows = await Shipment.find({ sellerId: seller._id }).sort({ createdAt: -1 }).limit(50).lean();
  return rows.map((row) => toShipmentView(row, 'seller'));
}

/**
 * @param {string} sellerUserId
 * @param {string} shipmentId
 * @param {string} to
 * @param {string} [note]
 */
export async function sellerTransition(sellerUserId, shipmentId, to, note = '') {
  const seller = await Seller.findOne({ userId: sellerUserId, status: 'approved' }).lean();
  if (!seller) throw new AppError('SELLER_REQUIRED', 'Apply to sell before continuing.', 403);
  const shipment = await Shipment.findOne({ _id: shipmentId, sellerId: seller._id });
  if (!shipment) throw new AppError('NOT_FOUND', 'Shipment not found.', 404);
  if (to === 'REJECTED' && note.trim().length < 3) {
    throw new AppError('VALIDATION_ERROR', 'A reject reason is required.', 400);
  }
  return toShipmentView(await transitionShipment(shipment, to, 'seller', sellerUserId, note), 'seller');
}

/**
 * @param {string} buyerId
 * @param {string} orderId
 * @param {string} note
 */
export async function buyerCancel(buyerId, orderId, note) {
  const shipments = await Shipment.find({ orderId, buyerId });
  if (shipments.length === 0) throw new AppError('NOT_FOUND', 'Order not found.', 404);
  for (const shipment of shipments) {
    if (!canTransition(shipment.status, 'CANCELLED', 'buyer')) {
      throw new AppError('ILLEGAL_TRANSITION', 'This order can no longer be cancelled.', 409);
    }
  }
  for (const shipment of shipments) {
    await transitionShipment(shipment, 'CANCELLED', 'buyer', buyerId, note || 'Cancelled by buyer');
  }
  return { cancelled: true };
}

/**
 * @param {string} shipmentId
 * @param {string} to
 * @param {string} note
 * @param {{ actorId: string, ip: string }} actor
 */
export async function adminTransition(shipmentId, to, note, actor) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new AppError('NOT_FOUND', 'Shipment not found.', 404);
  const before = shipment.status;
  const updated = await transitionShipment(shipment, to, 'admin', actor.actorId, note || 'Updated by admin');
  await writeAudit({
    actorId: actor.actorId,
    action: 'shipment.status',
    entityType: 'Shipment',
    entityId: String(shipment._id),
    before: { status: before },
    after: { status: to },
    ip: actor.ip,
  });
  return toShipmentView(updated, 'admin');
}
