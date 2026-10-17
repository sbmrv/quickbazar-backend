import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    roles: {
      type: [String],
      enum: ['buyer', 'seller', 'rider', 'admin'],
      default: ['buyer'],
    },
    pendingRoles: {
      type: [String],
      enum: ['seller', 'rider'],
      default: [],
    },
    adminRole: { type: String, enum: ['super', 'ops', 'finance', 'support'] },
    passwordHash: { type: String, select: false },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    codStrikes: { type: Number, default: 0, min: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

/**
 * @param {{ _id: unknown, phone?: string, name?: string, email?: string, roles?: string[], pendingRoles?: string[], adminRole?: string, status?: string }} user
 */
export function toPublic(user) {
  return {
    id: String(user._id),
    phone: user.phone ?? null,
    name: user.name ?? '',
    email: user.email ?? null,
    roles: user.roles ?? [],
    pendingRoles: user.pendingRoles ?? [],
    adminRole: user.adminRole ?? null,
    status: user.status,
  };
}
