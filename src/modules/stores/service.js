import { AppError } from '../../utils/AppError.js';
import { Product } from '../products/model.js';
import { ServiceArea } from '../serviceAreas/model.js';
import { Store, toStoreView } from './model.js';

/**
 * @param {{ status: string }} seller
 */
function assertCanEditStore(seller) {
  if (seller.status !== 'pending' && seller.status !== 'approved') {
    throw new AppError('SELLER_NOT_APPROVED', 'Your seller account cannot edit stores right now.', 403);
  }
}

/**
 * @param {{ type: 'Point', coordinates: [number, number] }} location
 */
async function areaForPoint(location) {
  const area = await ServiceArea.findOne({
    isActive: true,
    polygon: { $geoIntersects: { $geometry: location } },
  }).lean();
  if (!area) {
    throw new AppError('NOT_SERVICEABLE', 'Drop the pin inside an active Mumbai or Pune area.', 400);
  }
  return area;
}

/**
 * @param {{ day: number }[]} hours
 */
function assertUniqueDays(hours) {
  const days = new Set(hours.map((hour) => hour.day));
  if (days.size !== hours.length) {
    throw new AppError('VALIDATION_ERROR', 'Each weekday can appear once.', 400);
  }
}

/**
 * @param {Record<string, any>} body
 * @param {Record<string, any>} area
 */
function storeFields(body, area) {
  return {
    name: body.name,
    phone: body.phone,
    address: {
      line1: body.address.line1,
      line2: body.address.line2 ?? '',
      landmark: body.address.landmark ?? '',
      pincode: body.address.pincode,
    },
    city: area.city,
    location: body.location,
    serviceAreaId: area._id,
    radiusKm: body.radiusKm,
    prepTimeMin: body.prepTimeMin,
    busyExtraMin: body.busyExtraMin ?? 0,
    hours: body.hours,
    isOpen: body.isOpen,
    acceptingOrders: body.acceptingOrders,
  };
}

/**
 * @param {string} sellerId
 */
export async function listOwnStores(sellerId) {
  const stores = await Store.find({ sellerId, status: 'active' }).sort({ name: 1 }).lean();
  return stores.map(toStoreView);
}

/**
 * @param {{ _id: unknown, status: string }} seller
 * @param {Record<string, any>} body
 */
export async function createStore(seller, body) {
  assertCanEditStore(seller);
  assertUniqueDays(body.hours);
  const area = await areaForPoint(body.location);
  const store = await Store.create({
    sellerId: seller._id,
    status: 'active',
    ...storeFields(body, area),
  });
  return toStoreView(store);
}

/**
 * @param {{ _id: unknown, status: string }} seller
 * @param {string} storeId
 * @param {Record<string, any>} body
 */
export async function updateStore(seller, storeId, body) {
  assertCanEditStore(seller);
  assertUniqueDays(body.hours);
  const store = await Store.findOne({ _id: storeId, sellerId: seller._id, status: 'active' });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found.', 404);
  const area = await areaForPoint(body.location);
  Object.assign(store, storeFields(body, area));
  await store.save();
  return toStoreView(store);
}

/**
 * @param {{ _id: unknown, status: string }} seller
 * @param {string} storeId
 */
export async function deactivateStore(seller, storeId) {
  assertCanEditStore(seller);
  const store = await Store.findOne({ _id: storeId, sellerId: seller._id, status: 'active' });
  if (!store) throw new AppError('NOT_FOUND', 'Store not found.', 404);
  const products = await Product.countDocuments({ storeId: store._id, isActive: true });
  if (products > 0) {
    throw new AppError('STORE_HAS_PRODUCTS', 'Move or deactivate products before closing this store.', 409);
  }
  store.status = 'inactive';
  await store.save();
  return { deleted: true };
}
