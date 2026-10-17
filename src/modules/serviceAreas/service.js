import { AppError } from '../../utils/AppError.js';
import { writeAudit } from '../audit/service.js';
import { ServiceArea, toPublicArea } from './model.js';
import { parsePolygon } from './polygon.js';

/**
 * @param {unknown} polygon
 */
function requirePolygon(polygon) {
  const parsed = parsePolygon(polygon);
  if (!parsed.ok) throw new AppError('POLYGON_INVALID', parsed.message, 400);
  return parsed.polygon;
}

export async function listServiceAreas() {
  const rows = await ServiceArea.find().sort({ city: 1, name: 1 }).lean();
  return rows.map(toPublicArea);
}

/**
 * @param {Record<string, unknown>} input
 * @param {{ actorId: string, ip: string }} actor
 */
export async function createServiceArea(input, actor) {
  const polygon = requirePolygon(input.polygon);
  try {
    const created = await ServiceArea.create({
      city: input.city,
      name: input.name,
      polygon,
      isActive: input.isActive,
      codEnabled: input.codEnabled,
    });
    const after = toPublicArea(created);
    await writeAudit({
      actorId: actor.actorId,
      action: 'serviceArea.create',
      entityType: 'ServiceArea',
      entityId: after.id,
      before: null,
      after,
      ip: actor.ip,
    });
    return after;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      throw new AppError('DUPLICATE', 'A service area with that city and name already exists.', 409);
    }
    throw err;
  }
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} input
 * @param {{ actorId: string, ip: string }} actor
 */
export async function updateServiceArea(id, input, actor) {
  const existing = await ServiceArea.findById(id);
  if (!existing) throw new AppError('NOT_FOUND', 'Service area was not found.', 404);
  const before = toPublicArea(existing);
  if (input.city !== undefined) existing.city = input.city;
  if (input.name !== undefined) existing.name = input.name;
  if (input.polygon !== undefined) existing.polygon = requirePolygon(input.polygon);
  if (input.isActive !== undefined) existing.isActive = input.isActive;
  if (input.codEnabled !== undefined) existing.codEnabled = input.codEnabled;
  try {
    await existing.save();
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      throw new AppError('DUPLICATE', 'A service area with that city and name already exists.', 409);
    }
    throw err;
  }
  const after = toPublicArea(existing);
  await writeAudit({
    actorId: actor.actorId,
    action: 'serviceArea.update',
    entityType: 'ServiceArea',
    entityId: after.id,
    before,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} id
 * @param {{ actorId: string, ip: string }} actor
 */
export async function deleteServiceArea(id, actor) {
  const existing = await ServiceArea.findById(id);
  if (!existing) throw new AppError('NOT_FOUND', 'Service area was not found.', 404);
  const before = toPublicArea(existing);
  await existing.deleteOne();
  await writeAudit({
    actorId: actor.actorId,
    action: 'serviceArea.delete',
    entityType: 'ServiceArea',
    entityId: before.id,
    before,
    after: null,
    ip: actor.ip,
  });
}
