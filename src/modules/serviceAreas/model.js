import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    polygon: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    isActive: { type: Boolean, default: true },
    codEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

serviceAreaSchema.index({ polygon: '2dsphere' });
serviceAreaSchema.index({ city: 1, name: 1 }, { unique: true });

export const ServiceArea = mongoose.model('ServiceArea', serviceAreaSchema);

/**
 * @param {Record<string, unknown>} area
 */
export function toPublicArea(area) {
  return {
    id: String(area._id),
    city: area.city,
    name: area.name,
    polygon: area.polygon,
    isActive: Boolean(area.isActive),
    codEnabled: Boolean(area.codEnabled),
    updatedAt: area.updatedAt,
  };
}
