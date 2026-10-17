import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Waitlist = mongoose.model('Waitlist', waitlistSchema);

/**
 * @param {{ phone: string, lat: number, lng: number, note?: string }} body
 */
export async function joinWaitlist(body) {
  await Waitlist.create({
    phone: body.phone,
    location: { type: 'Point', coordinates: [body.lng, body.lat] },
    note: body.note ?? '',
  });
  return { joined: true };
}
