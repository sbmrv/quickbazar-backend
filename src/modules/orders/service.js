import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { AppError } from '../../utils/AppError.js';
import { User } from '../auth/model.js';
import { getOwnAddress } from '../addresses/service.js';
import { toAddress } from '../addresses/model.js';
import { readCart, reserveLine } from '../cart/service.js';
import { Cart } from '../cart/model.js';
import { checkServiceability } from '../discovery/service.js';
import { env } from '../../config/env.js';
import { schedulePaymentHold } from '../../jobs/paymentHold.js';
import { scheduleSellerAccept } from '../../jobs/sellerAccept.js';
import { quoteCoupon, redeemCoupon } from '../coupons/service.js';
import { notifyUser } from '../notifications/service.js';
import { createProviderOrder } from '../payments/service.js';
import { Seller } from '../sellers/model.js';
import { getSetting } from '../settings/service.js';
import { emitRoom } from '../../sockets/hub.js';
import { Order, Payment, Shipment } from './model.js';
import { toShipmentView } from '../shipments/service.js';

function code() {
  return String(randomInt(1000, 10000));
}

function replicaMessage(err) {
  const message = String(err?.message ?? '');
  return message.includes('replica set') || message.includes('Transaction numbers');
}

/**
 * @param {string} userId
 * @param {{ addressId: string, modes?: Record<string, string> }} body
 */
export async function buildQuote(userId, body) {
  const address = await getOwnAddress(userId, body.addressId);
  const [lng, lat] = address.location.coordinates;
  const cart = await readCart(userId, lng, lat, body.modes ?? {});
  if (cart.shipments.some((shipment) => !shipment.deliveryMode)) {
    cart.issues.push({ productId: '', sku: '', code: 'NOT_ELIGIBLE', message: 'Choose items that share a delivery mode.' });
  }
  let discount = 0;
  let couponCode = '';
  if (body.couponCode) {
    const priced = await quoteCoupon(userId, body.couponCode, cart.pricing.itemTotal);
    discount = priced.discount;
    couponCode = priced.coupon.code;
  }
  const user = await User.findById(userId).lean();
  const service = await checkServiceability(lng, lat);
  const beforeCod = Math.max(0, cart.pricing.itemTotal - discount) + cart.pricing.deliveryFee + cart.pricing.handlingFee + cart.pricing.smallCartFee;
  const cod = cart.settingsCod;
  const codAllowed = Boolean(
    cod.enabled &&
      service.area?.codEnabled &&
      beforeCod <= cod.maxOrderValuePaise &&
      (user?.codStrikes ?? 0) < cod.disableAfterStrikes &&
      cart.issues.length === 0,
  );
  const codFee = body.paymentMethod === 'ONLINE' ? 0 : codAllowed ? cod.codFeePaise : 0;
  const pricing = { ...cart.pricing, discount, codFee, grandTotal: beforeCod + codFee };
  return {
    address: toAddress(address),
    shipments: cart.shipments,
    issues: cart.issues,
    pricing,
    codAllowed,
    couponCode,
    serviceable: service.serviceable,
  };
}

/**
 * @param {Record<string, any>} order
 * @param {'buyer' | 'admin'} audience
 */
async function presentOrder(order, audience) {
  const shipments = await Shipment.find({ orderId: order._id }).lean();
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    pricing: order.pricing,
    address: order.addressSnapshot,
    createdAt: order.createdAt,
    shipments: shipments.map((shipment) => toShipmentView(shipment, audience)),
  };
}

/**
 * @param {string} userId
 * @param {{ addressId: string, modes?: Record<string, string>, expectedGrandTotalPaise?: number, paymentMethod?: 'COD' | 'ONLINE', couponCode?: string }} body
 * @param {string} idempotencyKey
 */
export async function placeOrder(userId, body, idempotencyKey) {
  const existing = await Order.findOne({ buyerId: userId, idempotencyKey });
  if (existing) return presentOrder(existing, 'buyer');

  const quote = await buildQuote(userId, body);
  if (!quote.serviceable) throw new AppError('NOT_SERVICEABLE', 'We do not deliver to that address yet.', 400);
  if (quote.issues.length > 0 || quote.shipments.length === 0) {
    throw new AppError('CART_INVALID', 'The cart needs attention before checkout.', 400, quote);
  }
  const method = body.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD';
  if (method === 'COD' && !quote.codAllowed) throw new AppError('COD_UNAVAILABLE', 'Cash on delivery is not available for this order.', 400);
  if (body.expectedGrandTotalPaise != null && body.expectedGrandTotalPaise !== quote.pricing.grandTotal) {
    throw new AppError('QUOTE_CHANGED', 'The total changed. Review the new quote.', 409, quote);
  }

  const session = await mongoose.startSession();
  let order;
  try {
    session.startTransaction();
    for (const shipment of quote.shipments) {
      for (const item of shipment.items) {
        await reserveLine(session, item);
      }
    }
    const orderNumber = `QB${nanoid(8).toUpperCase()}`;
    const [created] = await Order.create(
      [
        {
          orderNumber,
          buyerId: userId,
          addressSnapshot: quote.address,
          shipmentIds: [],
          pricing: quote.pricing,
          paymentMethod: method,
          paymentStatus: 'pending',
          status: method === 'ONLINE' ? 'PENDING_PAYMENT' : 'PLACED',
          couponCode: quote.couponCode || '',
          idempotencyKey,
        },
      ],
      { session },
    );
    const shipmentDocs = [];
    for (const [index, shipment] of quote.shipments.entries()) {
      const [doc] = await Shipment.create(
        [
          {
            orderId: created._id,
            shipmentNumber: `${orderNumber}-${index + 1}`,
            storeId: shipment.storeId,
            sellerId: shipment.sellerId,
            buyerId: userId,
            items: shipment.items,
            deliveryMode: shipment.deliveryMode,
            distanceKm: shipment.distanceKm,
            etaMinutesPromised: shipment.etaMinutes,
            fees: shipment.fees,
            status: method === 'ONLINE' ? 'PAYMENT_PENDING' : 'PLACED',
            timeline: [{ status: method === 'ONLINE' ? 'PAYMENT_PENDING' : 'PLACED', at: new Date(), by: userId, note: '' }],
            pickupCode: code(),
            deliveryOtp: code(),
            cod: { amountPaise: quote.shipments.length === 1 ? quote.pricing.grandTotal : shipment.fees.itemsPaise + shipment.fees.deliveryPaise },
          },
        ],
        { session },
      );
      shipmentDocs.push(doc);
    }
    created.shipmentIds = shipmentDocs.map((doc) => doc._id);
    await created.save({ session });
    await Payment.create(
      [
        {
          orderId: created._id,
          method,
          provider: method === 'ONLINE' ? 'razorpay' : 'cod',
          status: 'pending',
          amountPaise: quote.pricing.grandTotal,
          events: [{ type: 'created', at: new Date() }],
        },
      ],
      { session },
    );
    await Cart.updateOne({ userId }, { items: [] }, { session });
    if (quote.couponCode) {
      const { Coupon } = await import('../coupons/model.js');
      const coupon = await Coupon.findOne({ code: quote.couponCode }).session(session);
      if (coupon) await redeemCoupon(session, coupon._id, userId, created._id);
    }
    await session.commitTransaction();
    order = created;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // The transaction never started when Mongo is not a replica set.
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      const again = await Order.findOne({ buyerId: userId, idempotencyKey });
      if (again) return presentOrder(again, 'buyer');
    }
    if (replicaMessage(err)) {
      throw new AppError('REPLICA_SET_REQUIRED', 'MongoDB must be a replica set before an order can be placed.', 503);
    }
    throw err;
  } finally {
    session.endSession();
  }

  if (method === 'ONLINE') {
    const razorpay = await createProviderOrder(order);
    await schedulePaymentHold(String(order._id), env.PAYMENT_HOLD_MINUTES).catch(() => {});
    return { ...(await presentOrder(order, 'buyer')), razorpay };
  }
  const sellerSetting = await getSetting('seller');
  const shipments = await Shipment.find({ orderId: order._id }).lean();
  for (const shipment of shipments) {
    emitRoom(`store:${shipment.storeId}`, 'shipment:new', {
      shipmentId: String(shipment._id),
      orderId: String(order._id),
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
    });
    const seller = await Seller.findById(shipment.sellerId).select('userId').lean();
    if (seller) {
      await notifyUser(seller.userId, {
        title: 'New order',
        body: shipment.shipmentNumber,
        refType: 'shipment',
        refId: String(shipment._id),
      });
    }
    await scheduleSellerAccept(String(shipment._id), sellerSetting.acceptTimeoutSec).catch(() => {});
  }
  return { ...(await presentOrder(order, 'buyer')), razorpay: null };
}

/** COD-only alias kept for existing callers. */
export async function placeCodOrder(userId, body, idempotencyKey) {
  return placeOrder(userId, { ...body, paymentMethod: 'COD' }, idempotencyKey);
}

/**
 * @param {string} userId
 * @param {{ page: number, limit: number }} query
 */
export async function listOrders(userId, query) {
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    Order.find({ buyerId: userId }).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    Order.countDocuments({ buyerId: userId }),
  ]);
  const presented = [];
  for (const row of rows) presented.push(await presentOrder(row, 'buyer'));
  return { rows: presented, meta: { page: query.page, limit: query.limit, total } };
}

/**
 * @param {string} userId
 * @param {string} orderId
 */
export async function getOrder(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, buyerId: userId });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.', 404);
  return presentOrder(order, 'buyer');
}

/**
 * @param {{ page: number, limit: number }} query
 */
export async function listAdminOrders(query) {
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    Order.countDocuments(),
  ]);
  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      orderNumber: row.orderNumber,
      status: row.status,
      paymentMethod: row.paymentMethod,
      grandTotal: row.pricing.grandTotal,
      createdAt: row.createdAt,
    })),
    meta: { page: query.page, limit: query.limit, total },
  };
}

/**
 * @param {string} orderId
 */
export async function getAdminOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.', 404);
  return presentOrder(order, 'admin');
}
