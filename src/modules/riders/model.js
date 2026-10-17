import mongoose from 'mongoose';

const riderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    city: { type: String, required: true },
    vehicleType: { type: String, enum: ['bike', 'cycle', 'scooter'], default: 'bike' },
    vehicleNo: { type: String, default: '' },
    kyc: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
    availability: { type: String, enum: ['offline', 'online', 'busy'], default: 'offline' },
    currentShipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
    cashInHandPaise: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);

export const Rider = mongoose.model('Rider', riderSchema);

const logSchema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true, index: true },
  shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  speed: Number,
  heading: Number,
  accuracy: Number,
  ts: { type: Date, default: Date.now },
});
logSchema.index({ ts: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
logSchema.index({ location: '2dsphere' });

export const RiderLocationLog = mongoose.model('RiderLocationLog', logSchema);
