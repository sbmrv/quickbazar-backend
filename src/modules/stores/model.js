import mongoose from 'mongoose';

const hourSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false },
);

const storeSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, default: '', trim: true },
      landmark: { type: String, default: '', trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    city: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    serviceAreaId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceArea', required: true },
    radiusKm: {
      express: { type: Number, required: true },
      sameDay: { type: Number, required: true },
      standard: { type: Number, required: true },
    },
    prepTimeMin: { type: Number, required: true },
    busyExtraMin: { type: Number, default: 0 },
    hours: { type: [hourSchema], required: true },
    isOpen: { type: Boolean, default: true },
    acceptingOrders: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

storeSchema.index({ location: '2dsphere' });
storeSchema.index({ status: 1, isOpen: 1, acceptingOrders: 1 });

export const Store = mongoose.model('Store', storeSchema);

/**
 * @param {Record<string, any>} store
 */
export function toStoreView(store) {
  return {
    id: String(store._id),
    sellerId: String(store.sellerId),
    name: store.name,
    phone: store.phone,
    address: {
      line1: store.address?.line1 ?? '',
      line2: store.address?.line2 ?? '',
      landmark: store.address?.landmark ?? '',
      pincode: store.address?.pincode ?? '',
    },
    city: store.city,
    location: store.location,
    serviceAreaId: String(store.serviceAreaId),
    radiusKm: {
      express: store.radiusKm?.express,
      sameDay: store.radiusKm?.sameDay,
      standard: store.radiusKm?.standard,
    },
    prepTimeMin: store.prepTimeMin,
    busyExtraMin: store.busyExtraMin ?? 0,
    hours: (store.hours ?? []).map((hour) => ({ day: hour.day, open: hour.open, close: hour.close })),
    isOpen: Boolean(store.isOpen),
    acceptingOrders: Boolean(store.acceptingOrders),
    status: store.status,
    ratingAvg: store.ratingAvg ?? 0,
    ratingCount: store.ratingCount ?? 0,
    updatedAt: store.updatedAt,
  };
}
