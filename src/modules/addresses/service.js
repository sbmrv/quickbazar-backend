import { AppError } from '../../utils/AppError.js';
import { ServiceArea } from '../serviceAreas/model.js';
import { Address, toAddress } from './model.js';

/**
 * @param {{ type: 'Point', coordinates: [number, number] }} location
 */
async function areaFor(location) {
  const area = await ServiceArea.findOne({
    isActive: true,
    polygon: { $geoIntersects: { $geometry: location } },
  }).lean();
  if (!area) throw new AppError('NOT_SERVICEABLE', 'That pin is outside Mumbai and Pune.', 400);
  return area;
}

/**
 * @param {string} userId
 */
export async function listAddresses(userId) {
  const rows = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 }).lean();
  return rows.map(toAddress);
}

/**
 * @param {string} userId
 * @param {Record<string, any>} body
 */
export async function createAddress(userId, body) {
  const area = await areaFor(body.location);
  if (body.isDefault) await Address.updateMany({ userId }, { isDefault: false });
  const count = await Address.countDocuments({ userId });
  const address = await Address.create({
    userId,
    ...body,
    city: area.city,
    isDefault: body.isDefault || count === 0,
  });
  return toAddress(address);
}

/**
 * @param {string} userId
 * @param {string} id
 * @param {Record<string, any>} body
 */
export async function updateAddress(userId, id, body) {
  const address = await Address.findOne({ _id: id, userId });
  if (!address) throw new AppError('NOT_FOUND', 'Address not found.', 404);
  const area = await areaFor(body.location);
  if (body.isDefault) await Address.updateMany({ userId }, { isDefault: false });
  Object.assign(address, body, { city: area.city });
  await address.save();
  return toAddress(address);
}

/**
 * @param {string} userId
 * @param {string} id
 */
export async function deleteAddress(userId, id) {
  const result = await Address.deleteOne({ _id: id, userId });
  if (!result.deletedCount) throw new AppError('NOT_FOUND', 'Address not found.', 404);
  return { deleted: true };
}

/**
 * @param {string} userId
 * @param {string} id
 */
export async function getOwnAddress(userId, id) {
  const address = await Address.findOne({ _id: id, userId }).lean();
  if (!address) throw new AppError('NOT_FOUND', 'Address not found.', 404);
  return address;
}
