import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    kind: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true },
    maxDiscountPaise: { type: Number, default: 0 },
    minCartPaise: { type: Number, default: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    perUserLimit: { type: Number, default: 1 },
    globalLimit: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Coupon = mongoose.model('Coupon', couponSchema);

const redemptionSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  },
  { timestamps: true },
);
redemptionSchema.index({ couponId: 1, userId: 1 });

export const CouponRedemption = mongoose.model('CouponRedemption', redemptionSchema);
