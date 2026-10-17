import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: String, enum: ['store', 'product', 'rider'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
  },
  { timestamps: true },
);
reviewSchema.index({ shipmentId: 1, target: 1, targetId: 1 }, { unique: true });
export const Review = mongoose.model('Review', reviewSchema);

const returnSchema = new mongoose.Schema(
  {
    shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['requested', 'approved', 'rejected'], default: 'requested' },
  },
  { timestamps: true },
);
export const ReturnRequest = mongoose.model('ReturnRequest', returnSchema);

const wishSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true },
);
wishSchema.index({ userId: 1, productId: 1 }, { unique: true });
export const WishlistItem = mongoose.model('WishlistItem', wishSchema);

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: String, default: '' },
    href: { type: String, default: '/' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Banner = mongoose.model('Banner', bannerSchema);
