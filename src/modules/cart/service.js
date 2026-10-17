import { haversineKm } from '../../utils/geo.js';
import { AppError } from '../../utils/AppError.js';
import { Product } from '../products/model.js';
import { getAllSettings } from '../settings/service.js';
import { Store } from '../stores/model.js';
import { availableModes, availableUnits, deliveryFeePaise, fastestMode } from '../discovery/offer.js';
import { Cart } from './model.js';

/**
 * @param {string} userId
 * @param {{ productId: string, sku: string, qty: number }[]} items
 */
export async function saveCart(userId, items) {
  const cart = await Cart.findOneAndUpdate(
    { userId },
    { userId, items },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return cart;
}

/**
 * @param {string} userId
 */
export async function clearCart(userId) {
  await Cart.findOneAndUpdate({ userId }, { items: [] }, { upsert: true });
  return { items: [], issues: [], shipments: [] };
}

/**
 * @param {string} userId
 * @param {number} lng
 * @param {number} lat
 * @param {Record<string, string>} [modeChoices]
 */
export async function readCart(userId, lng, lat, modeChoices = {}) {
  const cart = (await Cart.findOne({ userId }).lean()) ?? { items: [] };
  const settings = await getAllSettings();
  const productIds = cart.items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true, approvalStatus: 'approved' }).lean();
  const byProduct = new Map(products.map((product) => [String(product._id), product]));
  const storeIds = [...new Set(products.map((product) => String(product.storeId)))];
  const stores = await Store.find({ _id: { $in: storeIds } }).lean();
  const byStore = new Map(stores.map((store) => [String(store._id), store]));
  const issues = [];
  /** @type {Map<string, any[]>} */
  const groups = new Map();

  for (const line of cart.items) {
    const product = byProduct.get(String(line.productId));
    const sku = line.sku.toUpperCase();
    if (!product) {
      issues.push({ productId: String(line.productId), sku, code: 'UNAVAILABLE', message: 'This item is no longer available.' });
      continue;
    }
    const variant = product.variants.find((item) => item.sku === sku);
    const store = byStore.get(String(product.storeId));
    if (!variant || !store || store.status !== 'active') {
      issues.push({ productId: String(product._id), sku, code: 'UNAVAILABLE', message: `${product.name} is unavailable.` });
      continue;
    }
    const units = availableUnits(product, sku);
    if (units < line.qty) {
      issues.push({ productId: String(product._id), sku, code: 'OUT_OF_STOCK', message: `${product.name} does not have enough stock.` });
      continue;
    }
    const distanceKm = haversineKm([lng, lat], store.location.coordinates);
    const modes = availableModes(product, { ...store, distanceKm }, distanceKm, settings);
    if (modes.length === 0) {
      issues.push({
        productId: String(product._id),
        sku,
        code: 'NOT_ELIGIBLE',
        message: `${product.name} cannot be delivered to this location.`,
      });
      continue;
    }
    const bucket = groups.get(String(store._id)) ?? [];
    bucket.push({ line, product, variant, store, distanceKm, modes });
    groups.set(String(store._id), bucket);
  }

  const shipments = [...groups.entries()].map(([storeId, rows]) => {
    const shared = rows.reduce((acc, row) => acc.filter((mode) => row.modes.some((item) => item.mode === mode.mode)), rows[0].modes);
    const chosen = modeChoices[storeId];
    const selected = shared.find((mode) => mode.mode === chosen) ?? fastestMode(shared);
    const items = rows.map((row) => ({
      productId: String(row.product._id),
      sku: row.variant.sku,
      name: row.product.name,
      image: row.product.images?.[0] ?? '',
      qty: row.line.qty,
      pricePaise: row.variant.pricePaise,
      mrpPaise: row.variant.mrpPaise,
      gstPct: row.product.gstPct,
      linePaise: row.variant.pricePaise * row.line.qty,
    }));
    const itemsPaise = items.reduce((sum, item) => sum + item.linePaise, 0);
    const deliveryPaise = selected
      ? deliveryFeePaise({ mode: selected.mode, distanceKm: rows[0].distanceKm, itemTotalPaise: itemsPaise, settings })
      : 0;
    return {
      storeId,
      storeName: rows[0].store.name,
      sellerId: String(rows[0].store.sellerId),
      distanceKm: Math.round(rows[0].distanceKm * 100) / 100,
      modes: shared,
      deliveryMode: selected?.mode ?? null,
      etaMinutes: selected?.etaMinutes ?? null,
      etaLabel: selected?.label ?? '',
      items,
      fees: { itemsPaise, deliveryPaise },
    };
  });

  const itemTotal = shipments.reduce((sum, shipment) => sum + shipment.fees.itemsPaise, 0);
  const deliveryFee = shipments.reduce((sum, shipment) => sum + shipment.fees.deliveryPaise, 0);
  const smallCartFee = itemTotal > 0 && itemTotal < settings.fees.smallCartBelowPaise ? settings.fees.smallCartFeePaise : 0;
  const handlingFee = itemTotal > 0 ? settings.fees.handlingFeePaise : 0;
  return {
    items: cart.items.map((item) => ({ productId: String(item.productId), sku: item.sku, qty: item.qty })),
    issues,
    shipments,
    pricing: {
      itemTotal,
      discount: 0,
      deliveryFee,
      handlingFee,
      smallCartFee,
      codFee: 0,
      grandTotal: itemTotal + deliveryFee + handlingFee + smallCartFee,
    },
    settingsCod: settings.cod,
  };
}

/**
 * @param {import('mongoose').ClientSession | null} session
 * @param {{ productId: string, sku: string, qty: number }} line
 */
export async function reserveLine(session, line) {
  const result = await Product.updateOne(
    { _id: line.productId, variants: { $elemMatch: { sku: line.sku, stock: { $gte: line.qty } } } },
    { $inc: { 'variants.$.stock': -line.qty, 'variants.$.reservedStock': line.qty } },
    { session },
  );
  if (result.matchedCount !== 1) {
    throw new AppError('OUT_OF_STOCK', 'An item just sold out.', 409);
  }
}

/**
 * @param {import('mongoose').ClientSession | null} session
 * @param {{ productId: string, sku: string, qty: number }} line
 */
export async function restockLine(session, line) {
  await Product.updateOne(
    { _id: line.productId, 'variants.sku': line.sku },
    { $inc: { 'variants.$.stock': line.qty, 'variants.$.reservedStock': -line.qty } },
    { session: session ?? undefined },
  );
}

/**
 * Reserved units become sold. Stock was already reduced at checkout.
 * @param {{ productId: string, sku: string, qty: number }} line
 */
export async function settleLine(line) {
  await Product.updateOne(
    { _id: line.productId, 'variants.sku': line.sku },
    { $inc: { 'variants.$.reservedStock': -line.qty, soldCount: line.qty } },
  );
}
