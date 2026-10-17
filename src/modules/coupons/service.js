import { AppError } from '../../utils/AppError.js';
import { Order } from '../orders/model.js';
import { Coupon, CouponRedemption } from './model.js';
import { couponDiscount } from './price.js';

/**
 * @param {string} userId
 * @param {string} code
 * @param {number} itemTotalPaise
 */
export async function quoteCoupon(userId, code, itemTotalPaise) {
  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() }).lean();
  if (!coupon) throw new AppError('COUPON_INVALID', 'That coupon is not valid.', 400);
  const [userUses, priorOrders] = await Promise.all([
    CouponRedemption.countDocuments({ couponId: coupon._id, userId }),
    Order.countDocuments({ buyerId: userId, paymentStatus: { $nin: ['failed', 'expired'] }, status: { $ne: 'CANCELLED' } }),
  ]);
  const result = couponDiscount(coupon, { itemTotalPaise, userUses, priorOrders });
  if (!result.ok) throw new AppError(result.code, 'That coupon cannot be applied.', 400);
  return { coupon, discount: result.discount };
}

/**
 * @param {import('mongoose').ClientSession | null} session
 * @param {string} couponId
 * @param {string} userId
 * @param {string} orderId
 */
export async function redeemCoupon(session, couponId, userId, orderId) {
  await CouponRedemption.create([{ couponId, userId, orderId }], { session: session ?? undefined });
  await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: 1 } }, { session: session ?? undefined });
}

/**
 * @param {Record<string, unknown>} body
 */
export async function saveCoupon(body) {
  const code = String(body.code).trim().toUpperCase();
  const doc = await Coupon.findOneAndUpdate({ code }, { ...body, code }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  return doc.toObject();
}

export async function listCoupons() {
  const rows = await Coupon.find().sort({ createdAt: -1 }).limit(50).lean();
  return rows.map((row) => ({ ...row, id: String(row._id) }));
}
