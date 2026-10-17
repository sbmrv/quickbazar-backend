import { AppError } from '../../utils/AppError.js';
import { writeAudit } from '../audit/service.js';
import { Category } from '../categories/model.js';
import { slugify } from '../categories/tree.js';
import { Seller } from '../sellers/model.js';
import { Store } from '../stores/model.js';
import { Product, toProductView } from './model.js';
import { approvalForNewProduct, needsRemoderation } from './rules.js';

/**
 * @param {string} sellerId
 * @param {string} name
 */
async function uniqueSlug(sellerId, name) {
  const base = slugify(name) === 'category' ? 'product' : slugify(name);
  let slug = base;
  let suffix = 2;
  while (await Product.exists({ sellerId, slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

/**
 * @param {{ _id: unknown }} seller
 * @param {string} storeId
 */
async function ownedStore(seller, storeId) {
  const store = await Store.findOne({ _id: storeId, sellerId: seller._id, status: 'active' }).lean();
  if (!store) throw new AppError('NOT_FOUND', 'Store not found.', 404);
  return store;
}

/**
 * @param {{ kyc?: { fssai?: string } }} seller
 * @param {string} categoryId
 */
async function loadCategory(seller, categoryId) {
  const category = await Category.findById(categoryId).lean();
  if (!category || !category.isActive) {
    throw new AppError('CATEGORY_INVALID', 'Choose an active category.', 400);
  }
  if (category.rules?.requiresFssai && !seller.kyc?.fssai) {
    throw new AppError('FSSAI_REQUIRED', 'Add an FSSAI licence before listing food.', 400);
  }
  return category;
}

/**
 * @param {Array<{ sku: string, label?: string, mrpPaise: number, pricePaise: number, stock: number, weightGrams: number, barcode?: string }>} variants
 * @param {Map<string, number>} [reservedBySku]
 */
function mapVariants(variants, reservedBySku = new Map()) {
  const seen = new Set();
  return variants.map((variant) => {
    const sku = variant.sku.toUpperCase();
    if (seen.has(sku)) throw new AppError('DUPLICATE_SKU', 'Each SKU must be unique.', 400);
    seen.add(sku);
    const reservedStock = reservedBySku.get(sku) ?? 0;
    if (variant.stock < reservedStock) {
      throw new AppError('STOCK_BELOW_RESERVED', 'Stock cannot drop below units already reserved.', 409);
    }
    return {
      sku,
      label: variant.label ?? '',
      mrpPaise: variant.mrpPaise,
      pricePaise: variant.pricePaise,
      stock: variant.stock,
      reservedStock,
      weightGrams: variant.weightGrams,
      barcode: variant.barcode ?? '',
    };
  });
}

/**
 * @param {Record<string, string> | undefined} attributes
 */
function mapAttributes(attributes) {
  const entries = Object.entries(attributes ?? {});
  if (entries.length > 12) throw new AppError('VALIDATION_ERROR', 'Use at most 12 attributes.', 400);
  return Object.fromEntries(entries);
}

/**
 * @param {string} sellerId
 * @param {{ page: number, limit: number }} query
 */
export async function listOwnProducts(sellerId, query) {
  const filter = { sellerId };
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(query.limit).lean(),
    Product.countDocuments(filter),
  ]);
  return {
    rows: rows.map(toProductView),
    meta: { page: query.page, limit: query.limit, total },
  };
}

/**
 * @param {{ _id: unknown }} seller
 * @param {string} productId
 */
export async function getOwnProduct(seller, productId) {
  const product = await Product.findOne({ _id: productId, sellerId: seller._id }).lean();
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  return toProductView(product);
}

/**
 * @param {{ _id: unknown, kyc?: { fssai?: string }, autoApproveProducts?: boolean }} seller
 * @param {Record<string, any>} body
 */
export async function createProduct(seller, body) {
  await ownedStore(seller, body.storeId);
  await loadCategory(seller, body.categoryId);
  const product = await Product.create({
    sellerId: seller._id,
    storeId: body.storeId,
    categoryId: body.categoryId,
    name: body.name,
    slug: await uniqueSlug(String(seller._id), body.name),
    description: body.description ?? '',
    brand: body.brand ?? '',
    images: body.images,
    attributes: mapAttributes(body.attributes),
    variants: mapVariants(body.variants),
    gstPct: body.gstPct,
    hsn: body.hsn ?? '',
    delivery: body.delivery,
    handlingTimeMin: body.handlingTimeMin,
    maxExpressDistanceKm: body.maxExpressDistanceKm ?? null,
    flags: body.flags,
    returnWindowDays: body.returnWindowDays,
    approvalStatus: approvalForNewProduct(Boolean(seller.autoApproveProducts)),
    rejectionReason: '',
    isActive: true,
  });
  return toProductView(product);
}

/**
 * @param {{ _id: unknown, kyc?: { fssai?: string }, autoApproveProducts?: boolean }} seller
 * @param {string} productId
 * @param {Record<string, any>} body
 */
export async function updateProduct(seller, productId, body) {
  const product = await Product.findOne({ _id: productId, sellerId: seller._id });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  await ownedStore(seller, body.storeId);
  await loadCategory(seller, body.categoryId);
  const reserved = new Map(product.variants.map((variant) => [variant.sku, variant.reservedStock ?? 0]));
  product.storeId = body.storeId;
  product.categoryId = body.categoryId;
  product.name = body.name;
  product.description = body.description ?? '';
  product.brand = body.brand ?? '';
  product.images = body.images;
  product.attributes = mapAttributes(body.attributes);
  product.variants = mapVariants(body.variants, reserved);
  product.gstPct = body.gstPct;
  product.hsn = body.hsn ?? '';
  product.delivery = body.delivery;
  product.handlingTimeMin = body.handlingTimeMin;
  product.maxExpressDistanceKm = body.maxExpressDistanceKm ?? null;
  product.flags = body.flags;
  product.returnWindowDays = body.returnWindowDays;
  product.isActive = true;
  if (needsRemoderation(Boolean(seller.autoApproveProducts))) {
    product.approvalStatus = 'pending';
  } else {
    product.approvalStatus = 'approved';
  }
  product.rejectionReason = '';
  await product.save();
  return toProductView(product);
}

/**
 * @param {{ _id: unknown }} seller
 * @param {string} productId
 * @param {{ sku: string, stock: number }} body
 */
export async function updateStock(seller, productId, body) {
  const product = await Product.findOne({ _id: productId, sellerId: seller._id });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  const sku = body.sku.toUpperCase();
  const variant = product.variants.find((item) => item.sku === sku);
  if (!variant) throw new AppError('NOT_FOUND', 'That SKU is not on this product.', 404);
  if (body.stock < (variant.reservedStock ?? 0)) {
    throw new AppError('STOCK_BELOW_RESERVED', 'Stock cannot drop below units already reserved.', 409);
  }
  variant.stock = body.stock;
  await product.save();
  return toProductView(product);
}

/**
 * @param {{ _id: unknown }} seller
 * @param {string} productId
 */
export async function deactivateProduct(seller, productId) {
  const product = await Product.findOne({ _id: productId, sellerId: seller._id });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  product.isActive = false;
  await product.save();
  return toProductView(product);
}

/**
 * @param {{ page: number, limit: number, status: string }} query
 */
export async function listModeration(query) {
  const filter = { approvalStatus: query.status, isActive: true };
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    Product.countDocuments(filter),
  ]);
  const sellers = await Seller.find({ _id: { $in: rows.map((row) => row.sellerId) } })
    .select('businessName')
    .lean();
  const byId = new Map(sellers.map((seller) => [String(seller._id), seller.businessName]));
  return {
    rows: rows.map((row) => ({
      ...toProductView(row),
      businessName: byId.get(String(row.sellerId)) ?? '',
    })),
    meta: { page: query.page, limit: query.limit, total },
  };
}

/**
 * @param {string} productId
 * @param {'approved' | 'rejected'} status
 * @param {string} reason
 * @param {{ actorId: string, ip: string }} actor
 */
async function decideProduct(productId, status, reason, actor) {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  const before = toProductView(product);
  product.approvalStatus = status;
  product.rejectionReason = reason;
  await product.save();
  const after = toProductView(product);
  await writeAudit({
    actorId: actor.actorId,
    action: status === 'approved' ? 'product.approve' : 'product.reject',
    entityType: 'Product',
    entityId: String(product._id),
    before,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} productId
 * @param {{ actorId: string, ip: string }} actor
 */
export function approveProduct(productId, actor) {
  return decideProduct(productId, 'approved', '', actor);
}

/**
 * @param {string} productId
 * @param {string} reason
 * @param {{ actorId: string, ip: string }} actor
 */
export function rejectProduct(productId, reason, actor) {
  return decideProduct(productId, 'rejected', reason, actor);
}
