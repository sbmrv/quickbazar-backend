import mongoose from 'mongoose';
import { stockLevel } from './rules.js';

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
    mrpPaise: { type: Number, required: true, min: 0 },
    pricePaise: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    reservedStock: { type: Number, required: true, min: 0, default: 0 },
    weightGrams: { type: Number, required: true, min: 1 },
    barcode: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    brand: { type: String, default: '', trim: true },
    images: { type: [String], default: [] },
    attributes: { type: Map, of: String, default: {} },
    variants: { type: [variantSchema], required: true },
    gstPct: { type: Number, required: true, min: 0 },
    hsn: { type: String, default: '', trim: true },
    delivery: {
      express: { type: Boolean, default: false },
      sameDay: { type: Boolean, default: false },
      standard: { type: Boolean, default: false },
    },
    handlingTimeMin: { type: Number, required: true, min: 0 },
    maxExpressDistanceKm: { type: Number, default: null },
    flags: {
      fragile: { type: Boolean, default: false },
      perishable: { type: Boolean, default: false },
      veg: { type: Boolean, default: null },
    },
    returnWindowDays: { type: Number, default: 0, min: 0 },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ storeId: 1, isActive: 1, approvalStatus: 1 });
productSchema.index({ categoryId: 1 });
productSchema.index({ sellerId: 1, slug: 1 }, { unique: true });
productSchema.index({ name: 'text', brand: 'text', description: 'text' });

export const Product = mongoose.model('Product', productSchema);

/**
 * @param {Record<string, any>} product
 */
export function toProductView(product) {
  const attributes =
    product.attributes instanceof Map
      ? Object.fromEntries(product.attributes)
      : (product.attributes ?? {});
  return {
    id: String(product._id),
    sellerId: String(product.sellerId),
    storeId: String(product.storeId),
    categoryId: String(product.categoryId),
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    brand: product.brand ?? '',
    images: product.images ?? [],
    attributes,
    variants: (product.variants ?? []).map((variant) => ({
      sku: variant.sku,
      label: variant.label ?? '',
      mrpPaise: variant.mrpPaise,
      pricePaise: variant.pricePaise,
      stock: variant.stock,
      reservedStock: variant.reservedStock ?? 0,
      weightGrams: variant.weightGrams,
      barcode: variant.barcode ?? '',
      stockLevel: stockLevel(variant.stock),
    })),
    gstPct: product.gstPct,
    hsn: product.hsn ?? '',
    delivery: {
      express: Boolean(product.delivery?.express),
      sameDay: Boolean(product.delivery?.sameDay),
      standard: Boolean(product.delivery?.standard),
    },
    handlingTimeMin: product.handlingTimeMin,
    maxExpressDistanceKm: product.maxExpressDistanceKm ?? null,
    flags: {
      fragile: Boolean(product.flags?.fragile),
      perishable: Boolean(product.flags?.perishable),
      veg: product.flags?.veg ?? null,
    },
    returnWindowDays: product.returnWindowDays ?? 0,
    approvalStatus: product.approvalStatus,
    rejectionReason: product.rejectionReason ?? '',
    isActive: Boolean(product.isActive),
    ratingAvg: product.ratingAvg ?? 0,
    ratingCount: product.ratingCount ?? 0,
    soldCount: product.soldCount ?? 0,
    updatedAt: product.updatedAt,
  };
}
