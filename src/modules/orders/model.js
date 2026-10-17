import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    addressSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    shipmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' }],
    pricing: {
      itemTotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      deliveryFee: { type: Number, required: true },
      handlingFee: { type: Number, required: true },
      smallCartFee: { type: Number, required: true },
      codFee: { type: Number, required: true },
      grandTotal: { type: Number, required: true },
    },
    paymentMethod: { type: String, enum: ['COD', 'ONLINE'], required: true },
    paymentStatus: { type: String, default: 'pending' },
    status: { type: String, enum: ['PENDING_PAYMENT', 'PLACED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'PLACED' },
    couponCode: { type: String, default: '' },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true },
);

orderSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true });

export const Order = mongoose.model('Order', orderSchema);

const shipmentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    shipmentNumber: { type: String, required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [mongoose.Schema.Types.Mixed], required: true },
    deliveryMode: { type: String, enum: ['EXPRESS', 'SAME_DAY', 'STANDARD'], required: true },
    slot: { start: String, end: String },
    distanceKm: { type: Number, required: true },
    etaMinutesPromised: { type: Number, required: true },
    promisedBy: { type: Date },
    fees: {
      itemsPaise: Number,
      deliveryPaise: Number,
    },
    status: { type: String, required: true, index: true },
    timeline: {
      type: [{ status: String, at: Date, by: String, note: String }],
      default: [],
    },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider' },
    assignment: { type: mongoose.Schema.Types.Mixed, default: {} },
    pickupCode: { type: String, required: true },
    deliveryOtp: { type: String, required: true },
    cod: { type: mongoose.Schema.Types.Mixed, default: {} },
    cancelReason: { type: String, default: '' },
    deliveredAt: { type: Date },
  },
  { timestamps: true },
);

export const Shipment = mongoose.model('Shipment', shipmentSchema);

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    method: { type: String, enum: ['COD', 'ONLINE'], required: true },
    provider: { type: String, enum: ['cod', 'razorpay'], required: true },
    providerOrderId: { type: String, default: '' },
    providerPaymentId: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    amountPaise: { type: Number, required: true },
    refunds: { type: [mongoose.Schema.Types.Mixed], default: [] },
    events: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
