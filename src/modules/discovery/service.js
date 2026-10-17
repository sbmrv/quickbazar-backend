import mongoose from 'mongoose';
import { logger } from '../../utils/logger.js';
import { readCache, writeCache } from '../../utils/cache.js';
import { geohashFor, haversineKm, kmToMeters } from '../../utils/geo.js';
import { AppError } from '../../utils/AppError.js';
import { Category } from '../categories/model.js';
import { Product } from '../products/model.js';
import { ServiceArea } from '../serviceAreas/model.js';
import { getAllSettings } from '../settings/service.js';
import { Store } from '../stores/model.js';
import { availableModes, availableUnits, deliveryFeePaise, fastestMode, rankFastest } from './offer.js';

const CACHE_TTL = 90;
const STORE_CAP = 40;

/**
 * @param {number} lng
 * @param {number} lat
 */
export async function checkServiceability(lng, lat) {
  const area = await ServiceArea.findOne({
    isActive: true,
    polygon: { $geoIntersects: { $geometry: { type: 'Point', coordinates: [lng, lat] } } },
  }).lean();
  if (!area) return { serviceable: false, area: null };
  return { serviceable: true, area: { id: String(area._id), city: area.city, name: area.name, codEnabled: Boolean(area.codEnabled) } };
}

/**
 * @param {number} lng
 * @param {number} lat
 * @param {number} maxKm
 */
async function candidateStores(lng, lat, maxKm) {
  const hash = geohashFor(lng, lat, 6);
  const key = `stores:near:${hash}:any`;
  const cached = await readCache(key);
  let points = cached;
  if (!points) {
    const rows = await Store.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: kmToMeters(maxKm) + 1000,
          spherical: true,
          query: { status: 'active' },
        },
      },
      { $limit: STORE_CAP },
      { $project: { _id: 1, location: 1 } },
    ]);
    points = rows.map((row) => ({ id: String(row._id), coordinates: row.location.coordinates }));
    await writeCache(key, points, CACHE_TTL);
    logger.info({ geohash: hash, stores: points.length }, 'store cache miss');
  } else {
    logger.info({ geohash: hash, stores: points.length }, 'store cache hit');
  }

  const ids = points.map((point) => new mongoose.Types.ObjectId(point.id));
  const stores = await Store.find({ _id: { $in: ids }, status: 'active' }).lean();
  return stores.map((store) => ({
    ...store,
    distanceKm: haversineKm([lng, lat], store.location.coordinates),
  }));
}

/**
 * @param {Record<string, any>} product
 */
function pricedVariant(product, inStockOnly) {
  const variants = product.variants.filter((variant) => !inStockOnly || availableUnits(product, variant.sku) > 0);
  if (variants.length === 0) return null;
  return [...variants].sort((a, b) => a.pricePaise - b.pricePaise)[0];
}

/**
 * @param {Record<string, any>} product
 * @param {Record<string, any>} store
 * @param {any} settings
 * @param {boolean} inStockOnly
 */
function toCard(product, store, settings, inStockOnly) {
  const variant = pricedVariant(product, inStockOnly);
  if (!variant) return null;
  const modes = availableModes(product, store, store.distanceKm, settings).map((mode) => ({
    ...mode,
    feePaise: deliveryFeePaise({
      mode: mode.mode,
      distanceKm: store.distanceKm,
      itemTotalPaise: variant.pricePaise,
      settings,
    }),
  }));
  const best = fastestMode(modes);
  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    brand: product.brand ?? '',
    image: product.images?.[0] ?? '',
    categoryId: String(product.categoryId),
    storeId: String(store._id),
    storeName: store.name,
    distanceKm: Math.round(store.distanceKm * 100) / 100,
    pricePaise: variant.pricePaise,
    mrpPaise: variant.mrpPaise,
    sku: variant.sku,
    inStock: availableUnits(product, variant.sku) > 0,
    ratingAvg: product.ratingAvg ?? 0,
    createdAt: product.createdAt,
    etaMinutes: best?.etaMinutes ?? 24 * 60 * 3,
    etaLabel: best?.label ?? '',
    mode: best?.mode ?? null,
    modes,
  };
}

/**
 * @param {number} lng
 * @param {number} lat
 */
async function loadCatalog(lng, lat) {
  const settings = await getAllSettings();
  const maxKm = Math.max(
    settings.modes.express.maxRadiusKm,
    settings.modes.sameDay.maxRadiusKm,
    25,
  );
  const stores = await candidateStores(lng, lat, maxKm);
  const products = await Product.find({
    storeId: { $in: stores.map((store) => store._id) },
    isActive: true,
    approvalStatus: 'approved',
  })
    .limit(300)
    .lean();
  const byStore = new Map(stores.map((store) => [String(store._id), store]));
  return { settings, products, byStore };
}

/**
 * @param {{ lng: number, lat: number }} query
 */
export async function discoveryHome(query) {
  const service = await checkServiceability(query.lng, query.lat);
  if (!service.serviceable) return { serviceable: false, area: null, banners: [], fastest: [] };
  const { settings, products, byStore } = await loadCatalog(query.lng, query.lat);
  const cards = products
    .map((product) => toCard(product, byStore.get(String(product.storeId)), settings, true))
    .filter((card) => card && card.mode && card.inStock);
  return { serviceable: true, area: service.area, banners: [], fastest: rankFastest(cards).slice(0, 12) };
}

/**
 * @param {Record<string, any>} query
 */
export async function discoveryProducts(query) {
  const service = await checkServiceability(query.lng, query.lat);
  if (!service.serviceable) {
    return { rows: [], meta: { page: query.page, limit: query.limit, total: 0 }, serviceable: false, area: null };
  }
  const { settings, products, byStore } = await loadCatalog(query.lng, query.lat);
  const inStockOnly = query.inStock !== 'false';
  let categoryId = null;
  if (query.category) {
    const category = await Category.findOne(
      mongoose.isValidObjectId(query.category) ? { _id: query.category } : { slug: query.category },
    ).lean();
    categoryId = category ? String(category._id) : 'missing';
  }
  let source = products;
  if (query.q) {
    try {
      const found = await Product.find({ $text: { $search: query.q } }).select('_id').limit(200).lean();
      const ids = new Set(found.map((row) => String(row._id)));
      source = products.filter((product) => ids.has(String(product._id)));
    } catch {
      const needle = query.q.toLowerCase();
      source = products.filter((product) => `${product.name} ${product.brand ?? ''}`.toLowerCase().includes(needle));
    }
  }
  let cards = source
    .filter((product) => {
      if (categoryId && String(product.categoryId) !== categoryId) return false;
      if (query.brand && product.brand?.toLowerCase() !== query.brand.toLowerCase()) return false;
      if (query.rating && (product.ratingAvg ?? 0) < query.rating) return false;
      return true;
    })
    .map((product) => toCard(product, byStore.get(String(product.storeId)), settings, false))
    .filter(Boolean)
    .filter((card) => (inStockOnly ? card.inStock && card.mode : true))
    .filter((card) => (query.mode ? card.modes.some((mode) => mode.mode === query.mode) : true))
    .filter((card) => (query.maxEtaMin ? card.etaMinutes <= query.maxEtaMin : true))
    .filter((card) => (query.minPrice != null ? card.pricePaise >= query.minPrice : true))
    .filter((card) => (query.maxPrice != null ? card.pricePaise <= query.maxPrice : true));

  if (!inStockOnly) {
    const stocked = cards.filter((card) => card.inStock);
    const empty = cards.filter((card) => !card.inStock);
    cards = [...sortCards(stocked, query.sort), ...empty];
  } else {
    cards = sortCards(cards, query.sort);
  }
  const start = (query.page - 1) * query.limit;
  return {
    serviceable: true,
    area: service.area,
    rows: cards.slice(start, start + query.limit),
    meta: { page: query.page, limit: query.limit, total: cards.length },
  };
}

/**
 * @param {any[]} cards
 * @param {string} sort
 */
function sortCards(cards, sort) {
  if (sort === 'nearest') return [...cards].sort((a, b) => a.distanceKm - b.distanceKm);
  if (sort === 'price_asc') return [...cards].sort((a, b) => a.pricePaise - b.pricePaise);
  if (sort === 'price_desc') return [...cards].sort((a, b) => b.pricePaise - a.pricePaise);
  if (sort === 'rating') return [...cards].sort((a, b) => b.ratingAvg - a.ratingAvg);
  if (sort === 'newest') return [...cards].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return rankFastest(cards);
}

/**
 * @param {string} id
 * @param {{ lng: number, lat: number }} query
 */
export async function discoveryProduct(id, query) {
  const product = await Product.findOne({ _id: id, isActive: true, approvalStatus: 'approved' }).lean();
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  const store = await Store.findById(product.storeId).lean();
  if (!store) throw new AppError('NOT_FOUND', 'Store not found.', 404);
  const settings = await getAllSettings();
  const distanceKm = haversineKm([query.lng, query.lat], store.location.coordinates);
  const withDistance = { ...store, distanceKm };
  const card = toCard(product, withDistance, settings, false);
  const service = await checkServiceability(query.lng, query.lat);
  return {
    ...card,
    description: product.description ?? '',
    gstPct: product.gstPct,
    flags: product.flags,
    handlingTimeMin: product.handlingTimeMin,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      label: variant.label,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      units: availableUnits(product, variant.sku),
    })),
    serviceable: service.serviceable,
    area: service.area,
  };
}
