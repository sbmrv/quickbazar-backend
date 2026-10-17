import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    refType: { type: String, default: '' },
    refId: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Notification = mongoose.model('Notification', notificationSchema);
