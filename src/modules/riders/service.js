import { AppError } from '../../utils/AppError.js';
import { User } from '../auth/model.js';
import { Order, Shipment } from '../orders/model.js';
import { transitionShipment } from '../shipments/service.js';
import { balancePaise } from '../ledger/service.js';
import { respondToOffer } from '../../jobs/assignment.js';
import { Rider } from './model.js';

/**
 * @param {string} userId
 * @param {{ city: string, vehicleType?: string, vehicleNo?: string }} body
 */
export async function applyRider(userId, body) {
  const existing = await Rider.findOne({ userId });
  if (existing && existing.status !== 'rejected') return existing;
  const rider = await Rider.findOneAndUpdate(
    { userId },
    { userId, city: body.city, vehicleType: body.vehicleType ?? 'bike', vehicleNo: body.vehicleNo ?? '', status: 'pending' },
    { upsert: true, returnDocument: 'after' },
  );
  await User.updateOne({ _id: userId }, { $addToSet: { pendingRoles: 'rider' } });
  return rider;
}

/**
 * @param {string} riderId
 * @param {'approved' | 'suspended'} status
 */
export async function setRiderStatus(riderId, status) {
  const rider = await Rider.findById(riderId);
  if (!rider) throw new AppError('NOT_FOUND', 'Rider not found.', 404);
  rider.status = status;
  await rider.save();
  if (status === 'approved') {
    await User.updateOne({ _id: rider.userId }, { $addToSet: { roles: 'rider' }, $pull: { pendingRoles: 'rider' } });
  }
  return rider;
}

/**
 * @param {string} userId
 * @param {'online' | 'offline'} availability
 */
export async function setAvailability(userId, availability) {
  const rider = await Rider.findOne({ userId, status: 'approved' });
  if (!rider) throw new AppError('RIDER_REQUIRED', 'Ask an admin to approve your rider profile.', 403);
  if (rider.availability === 'busy' && availability === 'offline') {
    throw new AppError('RIDER_BUSY', 'Finish the current trip before going offline.', 409);
  }
  rider.availability = availability;
  rider.lastSeenAt = new Date();
  await rider.save();
  return rider;
}

/**
 * @param {string} userId
 */
export async function currentTrip(userId) {
  const rider = await Rider.findOne({ userId }).lean();
  if (!rider) return null;
  const shipment = rider.currentShipmentId ? await Shipment.findById(rider.currentShipmentId).lean() : null;
  return { rider, shipment };
}

/**
 * @param {string} userId
 * @param {string} shipmentId
 * @param {'accept' | 'reject' | 'pickup' | 'arrived' | 'deliver' | 'fail'} action
 * @param {Record<string, any>} body
 */
export async function riderAction(userId, shipmentId, action, body) {
  const rider = await Rider.findOne({ userId, status: 'approved' });
  if (!rider) throw new AppError('RIDER_REQUIRED', 'Ask an admin to approve your rider profile.', 403);
  if (action === 'accept' || action === 'reject') {
    return respondToOffer(userId, shipmentId, action === 'accept');
  }
  const shipment = await Shipment.findOne({ _id: shipmentId, riderId: rider._id });
  if (!shipment) throw new AppError('NOT_FOUND', 'Shipment not found.', 404);
  if (action === 'pickup') {
    if (shipment.pickupCode !== String(body.code ?? '')) throw new AppError('BAD_CODE', 'Pickup code did not match.', 400);
    await transitionShipment(shipment, 'PICKED_UP', 'rider', userId, '');
  } else if (action === 'arrived') {
    await transitionShipment(shipment, 'ARRIVED', 'rider', userId, '');
  } else if (action === 'deliver') {
    if (shipment.deliveryOtp !== String(body.otp ?? '')) throw new AppError('BAD_OTP', 'Delivery OTP did not match.', 400);
    const order = await Order.findById(shipment.orderId).lean();
    if (order?.paymentMethod === 'COD') {
      const due = shipment.cod?.amountPaise ?? order.pricing.grandTotal;
      if (Number(body.codAmountPaise) !== due) throw new AppError('COD_AMOUNT', 'Collected cash must equal the amount due.', 400);
      shipment.cod = { amountPaise: due, collectedAt: new Date(), collectedBy: rider._id };
    }
    await transitionShipment(shipment, 'DELIVERED', 'rider', userId, '');
    rider.availability = 'online';
    rider.currentShipmentId = undefined;
    await rider.save();
    if (order?.paymentMethod === 'COD') await Order.updateOne({ _id: order._id }, { paymentStatus: 'collected' });
  } else if (action === 'fail') {
    await transitionShipment(shipment, 'DELIVERY_FAILED', 'rider', userId, String(body.reason ?? ''));
    const order = await Order.findById(shipment.orderId).lean();
    if (order?.paymentMethod === 'COD') await User.updateOne({ _id: shipment.buyerId }, { $inc: { codStrikes: 1 } });
    rider.availability = 'online';
    rider.currentShipmentId = undefined;
    await rider.save();
  }
  return shipment;
}

/**
 * @param {string} shipmentId
 * @param {string} riderId
 */
export async function manualAssign(shipmentId, riderId) {
  const rider = await Rider.findOne({ _id: riderId, status: 'approved' });
  const shipment = await Shipment.findById(shipmentId);
  if (!rider || !shipment) throw new AppError('NOT_FOUND', 'Rider or shipment not found.', 404);
  shipment.riderId = rider._id;
  shipment.assignment = { state: 'ASSIGNED', offers: shipment.assignment?.offers ?? [] };
  rider.availability = 'busy';
  rider.currentShipmentId = shipment._id;
  await shipment.save();
  await rider.save();
  return shipment;
}

export async function riderEarnings(userId) {
  const rider = await Rider.findOne({ userId }).lean();
  if (!rider) throw new AppError('RIDER_REQUIRED', 'Ask an admin to approve your rider profile.', 403);
  return { cashInHandPaise: rider.cashInHandPaise, balancePaise: await balancePaise('rider', String(rider._id)) };
}

export async function listRiders() {
  const rows = await Rider.find().sort({ createdAt: -1 }).limit(50).lean();
  return rows.map((row) => ({ ...row, id: String(row._id) }));
}
