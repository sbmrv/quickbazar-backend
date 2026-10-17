/**
 * Discount in paise. Returns an error code instead of throwing so tests stay pure.
 * @param {{ kind: string, value: number, maxDiscountPaise?: number, minCartPaise?: number, isActive?: boolean, startsAt?: Date, endsAt?: Date, globalLimit?: number, usedCount?: number, perUserLimit?: number, firstOrderOnly?: boolean }} coupon
 * @param {{ itemTotalPaise: number, userUses: number, priorOrders: number, now?: Date }} ctx
 */
export function couponDiscount(coupon, ctx) {
  const now = ctx.now ?? new Date();
  if (!coupon || coupon.isActive === false) return { ok: false, code: 'COUPON_INVALID' };
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return { ok: false, code: 'COUPON_INVALID' };
  if (coupon.endsAt && now > new Date(coupon.endsAt)) return { ok: false, code: 'COUPON_EXPIRED' };
  if (ctx.itemTotalPaise < (coupon.minCartPaise ?? 0)) return { ok: false, code: 'COUPON_MIN_CART' };
  if (coupon.globalLimit && coupon.usedCount >= coupon.globalLimit) return { ok: false, code: 'COUPON_LIMIT' };
  if (ctx.userUses >= (coupon.perUserLimit ?? 1)) return { ok: false, code: 'COUPON_LIMIT' };
  if (coupon.firstOrderOnly && ctx.priorOrders > 0) return { ok: false, code: 'COUPON_FIRST_ORDER' };
  let discount = coupon.kind === 'percent' ? Math.round((ctx.itemTotalPaise * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscountPaise) discount = Math.min(discount, coupon.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, ctx.itemTotalPaise));
  return { ok: true, discount };
}
