import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    image: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    rules: {
      requiresFssai: { type: Boolean, default: false },
      defaultDelivery: {
        express: { type: Boolean, default: true },
        sameDay: { type: Boolean, default: true },
        standard: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true },
);

export const Category = mongoose.model('Category', categorySchema);

/**
 * @param {import('mongoose').Document | Record<string, unknown>} category
 */
export function toPublicCategory(category) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ? String(category.parentId) : null,
    image: category.image || '',
    sortOrder: category.sortOrder ?? 0,
    isActive: Boolean(category.isActive),
    rules: {
      requiresFssai: Boolean(category.rules?.requiresFssai),
      defaultDelivery: {
        express: category.rules?.defaultDelivery?.express !== false,
        sameDay: category.rules?.defaultDelivery?.sameDay !== false,
        standard: category.rules?.defaultDelivery?.standard !== false,
      },
    },
  };
}
