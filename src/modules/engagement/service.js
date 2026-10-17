import { AppError } from '../../utils/AppError.js';
import { Product } from '../products/model.js';
import { Rider } from '../riders/model.js';
import { Shipment } from '../orders/model.js';
import { Store } from '../stores/model.js';
import { transitionShipment } from '../shipments/service.js';
import { saveCart } from '../cart/service.js';
import { Banner, ReturnRequest, Review, WishlistItem } from './models.js';

async function rollup(model, id) {
  const rows = await Review.find({ targetId: id }).select('rating').lean();
  const ratingCount = rows.length;
  const ratingAvg = ratingCount ? rows.reduce((sum, row) => sum + row.rating, 0) / ratingCount : 0;
  await model.updateOne({ _id: id }, { ratingAvg, ratingCount });
}

/**
 * @param {string} userId
 * @param {string} shipmentId
 * @param {{ target: 'store' | 'product' | 'rider', targetId: string, rating: number, comment?: string }} body
 */
export async function addReview(userId, shipmentId, body) {
  const shipment = await Shipment.findOne({ _id: shipmentId, buyerId: userId, status: 'DELIVERED' });
  if (!shipment) throw new AppError('NOT_DELIVERED', 'Reviews open after delivery.', 400);
  const review = await Review.create({ shipmentId, buyerId: userId, ...body });
  if (body.target === 'store') await rollup(Store, body.targetId);
  if (body.target === 'product') await rollup(Product, body.targetId);
  if (body.target === 'rider') await rollup(Rider, body.targetId);
  return review;
}

/**
 * @param {string} userId
 * @param {{ shipmentId: string, reason: string }} body
 */
export async function requestReturn(userId, body) {
  const shipment = await Shipment.findOne({ _id: body.shipmentId, buyerId: userId, status: 'DELIVERED' });
  if (!shipment?.deliveredAt) throw new AppError('NOT_DELIVERED', 'This shipment is not delivered.', 400);
  const product = await Product.findById(shipment.items[0]?.productId).select('returnWindowDays').lean();
  const days = product?.returnWindowDays ?? 0;
  const deadline = new Date(shipment.deliveredAt.getTime() + days * 86400000);
  if (days <= 0 || Date.now() > deadline.getTime()) throw new AppError('RETURN_WINDOW', 'The return window has closed.', 400);
  await transitionShipment(shipment, 'RETURN_REQUESTED', 'buyer', userId, body.reason);
  return ReturnRequest.create({ shipmentId: shipment._id, buyerId: userId, reason: body.reason });
}

/**
 * @param {string} returnId
 * @param {boolean} approve
 * @param {string} actorId
 * @param {'seller' | 'admin'} actor
 */
export async function decideReturn(returnId, approve, actorId, actor) {
  const request = await ReturnRequest.findById(returnId);
  if (!request) throw new AppError('NOT_FOUND', 'Return not found.', 404);
  const shipment = await Shipment.findById(request.shipmentId);
  if (!shipment) throw new AppError('NOT_FOUND', 'Shipment not found.', 404);
  request.status = approve ? 'approved' : 'rejected';
  await request.save();
  await transitionShipment(shipment, approve ? 'RETURN_APPROVED' : 'RETURN_REJECTED', actor, actorId, request.reason);
  if (approve) await transitionShipment(shipment, 'RETURNED', actor, actorId, 'Refund issued');
  return request;
}

export async function listWishlist(userId) {
  return WishlistItem.find({ userId }).limit(50).lean();
}

export async function addWish(userId, productId) {
  await WishlistItem.updateOne({ userId, productId }, { userId, productId }, { upsert: true });
  return listWishlist(userId);
}

export async function removeWish(userId, productId) {
  await WishlistItem.deleteOne({ userId, productId });
  return listWishlist(userId);
}

/**
 * Put a previous order's lines back in the cart.
 * @param {string} userId
 * @param {string} orderId
 */
export async function reorder(userId, orderId) {
  const shipments = await Shipment.find({ orderId, buyerId: userId }).lean();
  if (shipments.length === 0) throw new AppError('NOT_FOUND', 'Order not found.', 404);
  const items = shipments.flatMap((shipment) => shipment.items.map((item) => ({ productId: item.productId, sku: item.sku, qty: item.qty })));
  await saveCart(userId, items);
  return { items };
}

export async function listBanners() {
  return Banner.find({ isActive: true }).sort({ sortOrder: 1 }).limit(20).lean();
}

export async function saveBanner(body) {
  if (body.id) return Banner.findByIdAndUpdate(body.id, body, { returnDocument: 'after' });
  return Banner.create(body);
}
