import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { razorpayClient, razorpayKeyId } from '../../config/razorpay.js';
import { AppError } from '../../utils/AppError.js';
import { Order, Payment, Shipment } from '../orders/model.js';
import { transitionShipment } from '../shipments/service.js';
import { paymentSignature, signaturesMatch, webhookSignature } from './sign.js';

const seen = new mongoose.Schema(
  { eventId: { type: String, required: true, unique: true }, type: { type: String, required: true } },
  { timestamps: true },
);
const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', seen);

/**
 * @param {import('mongoose').Document} order
 */
export function checkoutPayload(order, providerOrderId) {
  if (order.paymentMethod !== 'ONLINE' || !providerOrderId) return null;
  return {
    keyId: razorpayKeyId(),
    orderId: providerOrderId,
    amount: order.pricing.grandTotal,
    currency: 'INR',
    name: 'QuickBazaar',
    description: order.orderNumber,
  };
}

/**
 * Create the Razorpay order for a pending online payment.
 * @param {import('mongoose').Document} order
 */
export async function createProviderOrder(order) {
  const client = razorpayClient();
  if (!client) throw new AppError('PAYMENT_NOT_CONFIGURED', 'Add Razorpay test keys before paying online.', 503);
  const created = await client.orders.create({
    amount: order.pricing.grandTotal,
    currency: 'INR',
    receipt: order.orderNumber,
  });
  await Payment.updateOne({ orderId: order._id }, { providerOrderId: created.id });
  return checkoutPayload(order, created.id);
}

/**
 * Move an unpaid online order to placed after a captured payment. Idempotent.
 * @param {string} providerOrderId
 * @param {string} providerPaymentId
 */
export async function capturePayment(providerOrderId, providerPaymentId) {
  const payment = await Payment.findOne({ providerOrderId });
  if (!payment) return null;
  if (payment.status === 'captured') return payment;
  payment.status = 'captured';
  payment.providerPaymentId = providerPaymentId;
  payment.events.push({ type: 'payment.captured', at: new Date(), providerPaymentId });
  await payment.save();
  await Order.updateOne({ _id: payment.orderId }, { paymentStatus: 'paid', status: 'PLACED' });
  const shipments = await Shipment.find({ orderId: payment.orderId });
  for (const shipment of shipments) {
    if (shipment.status === 'PAYMENT_PENDING') {
      await transitionShipment(shipment, 'PLACED', 'system', 'system', 'Payment captured');
    }
  }
  return payment;
}

/**
 * @param {string} providerOrderId
 */
export async function failPayment(providerOrderId) {
  const payment = await Payment.findOne({ providerOrderId });
  if (!payment || payment.status === 'captured' || payment.status === 'failed') return payment;
  payment.status = 'failed';
  payment.events.push({ type: 'payment.failed', at: new Date() });
  await payment.save();
  await Order.updateOne({ _id: payment.orderId }, { paymentStatus: 'failed', status: 'CANCELLED' });
  const shipments = await Shipment.find({ orderId: payment.orderId });
  for (const shipment of shipments) {
    if (shipment.status === 'PAYMENT_PENDING') {
      await transitionShipment(shipment, 'CANCELLED', 'system', 'system', 'Payment failed');
    }
  }
  return payment;
}

/**
 * @param {string} orderId
 */
export async function expireUnpaidOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.paymentMethod !== 'ONLINE' || order.paymentStatus === 'paid') return;
  if (order.paymentStatus === 'expired' || order.paymentStatus === 'failed') return;
  order.paymentStatus = 'expired';
  order.status = 'CANCELLED';
  await order.save();
  await Payment.updateOne({ orderId }, { status: 'expired' });
  const shipments = await Shipment.find({ orderId });
  for (const shipment of shipments) {
    if (shipment.status === 'PAYMENT_PENDING') {
      await transitionShipment(shipment, 'CANCELLED', 'system', 'system', 'Payment window expired');
    }
  }
}

/**
 * Verify the Checkout signature and capture. Safe to call twice.
 * @param {string} userId
 * @param {{ orderId: string, razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string }} body
 */
export async function verifyCheckout(userId, body) {
  const order = await Order.findOne({ _id: body.orderId, buyerId: userId });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found.', 404);
  const payment = await Payment.findOne({ orderId: order._id });
  if (!payment || payment.providerOrderId !== body.razorpayOrderId) {
    throw new AppError('PAYMENT_MISMATCH', 'That payment does not belong to this order.', 400);
  }
  if (!env.RAZORPAY_KEY_SECRET) throw new AppError('PAYMENT_NOT_CONFIGURED', 'Razorpay secret is missing.', 503);
  const expected = paymentSignature(body.razorpayOrderId, body.razorpayPaymentId, env.RAZORPAY_KEY_SECRET);
  if (!signaturesMatch(expected, body.razorpaySignature)) {
    throw new AppError('BAD_SIGNATURE', 'Payment signature did not match.', 400);
  }
  await capturePayment(body.razorpayOrderId, body.razorpayPaymentId);
  const fresh = await Order.findById(order._id);
  return fresh;
}

/**
 * Refund a captured online payment. COD is a no-op. Idempotent per payment.
 * @param {string} orderId
 * @param {string} reason
 * @param {number} [amountPaise]
 */
export async function refundIfPaid(orderId, reason, amountPaise) {
  const payment = await Payment.findOne({ orderId });
  if (!payment || payment.provider !== 'razorpay' || payment.status !== 'captured') return null;
  const already = payment.refunds.reduce((sum, row) => sum + (row.amountPaise ?? 0), 0);
  const due = amountPaise ?? payment.amountPaise - already;
  if (due <= 0) return payment;
  const client = razorpayClient();
  let refundId = `local_${Date.now()}`;
  if (client && payment.providerPaymentId) {
    const refund = await client.payments.refund(payment.providerPaymentId, { amount: due });
    refundId = refund.id;
  }
  payment.refunds.push({ refundId, amountPaise: due, status: 'processed', reason });
  payment.status = already + due >= payment.amountPaise ? 'refunded' : 'partially_refunded';
  await payment.save();
  await Order.updateOne({ _id: orderId }, { paymentStatus: payment.status });
  return payment;
}

/**
 * @param {Buffer} rawBody
 * @param {string | undefined} signature
 */
export async function handleWebhook(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError('PAYMENT_NOT_CONFIGURED', 'Webhook secret is missing.', 503);
  const expected = webhookSignature(rawBody, env.RAZORPAY_WEBHOOK_SECRET);
  if (!signaturesMatch(expected, signature ?? '')) throw new AppError('BAD_SIGNATURE', 'Webhook signature did not match.', 400);
  const body = JSON.parse(rawBody.toString('utf8'));
  const eventId = body?.payload?.payment?.entity?.id
    ? `${body.event}:${body.payload.payment.entity.id}`
    : `${body.event}:${body.created_at ?? ''}`;
  try {
    await WebhookEvent.create({ eventId, type: body.event });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) return { duplicate: true };
    throw err;
  }
  const entity = body?.payload?.payment?.entity ?? body?.payload?.refund?.entity;
  const providerOrderId = entity?.order_id;
  if (body.event === 'payment.captured' && providerOrderId) {
    await capturePayment(providerOrderId, entity.id);
  } else if (body.event === 'payment.failed' && providerOrderId) {
    await failPayment(providerOrderId);
  } else if (body.event === 'refund.processed' && providerOrderId) {
    await Payment.updateOne(
      { providerOrderId },
      { $push: { events: { type: 'refund.processed', at: new Date(), refundId: entity?.id } } },
    );
  }
  return { duplicate: false };
}

/**
 * @param {{ page: number, limit: number }} query
 */
export async function listPayments(query) {
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    Payment.find().sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    Payment.countDocuments(),
  ]);
  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      orderId: String(row.orderId),
      method: row.method,
      provider: row.provider,
      status: row.status,
      amountPaise: row.amountPaise,
      refunds: row.refunds ?? [],
    })),
    meta: { page: query.page, limit: query.limit, total },
  };
}
