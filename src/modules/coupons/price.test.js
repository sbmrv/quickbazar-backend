import { describe, expect, it } from 'vitest';
import { couponDiscount } from './price.js';

const base = { kind: 'percent', value: 10, maxDiscountPaise: 5000, minCartPaise: 10000, isActive: true, perUserLimit: 1, usedCount: 0 };

describe('coupon rules', () => {
  it('caps a percent discount and rejects expired, min-cart, and reuse', () => {
    expect(couponDiscount(base, { itemTotalPaise: 80000, userUses: 0, priorOrders: 0 }).discount).toBe(5000);
    expect(couponDiscount(base, { itemTotalPaise: 1000, userUses: 0, priorOrders: 0 }).code).toBe('COUPON_MIN_CART');
    expect(couponDiscount({ ...base, endsAt: new Date('2020-01-01') }, { itemTotalPaise: 80000, userUses: 0, priorOrders: 0 }).code).toBe('COUPON_EXPIRED');
    expect(couponDiscount(base, { itemTotalPaise: 80000, userUses: 1, priorOrders: 0 }).code).toBe('COUPON_LIMIT');
    expect(couponDiscount({ ...base, kind: 'flat', value: 2000, firstOrderOnly: true }, { itemTotalPaise: 80000, userUses: 0, priorOrders: 2 }).code).toBe('COUPON_FIRST_ORDER');
  });
});
