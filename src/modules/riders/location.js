import { getRedis } from '../../config/redis.js';
import { emitRoom } from '../../sockets/hub.js';
import { Shipment } from '../orders/model.js';
import { Rider, RiderLocationLog } from './model.js';

const lastSample = new Map();

/**
 * Validate a GPS ping, update Redis GEO, and relay it to the active shipment.
 * @param {string} userId
 * @param {{ lat: number, lng: number, heading?: number, speed?: number, accuracy?: number, ts?: number }} body
 */
export async function ingestLocation(userId, body) {
  if (body.accuracy != null && body.accuracy > 100) return { accepted: false };
  if (body.speed != null && body.speed > 40) return { accepted: false };
  const rider = await Rider.findOne({ userId, status: 'approved' });
  if (!rider || rider.availability === 'offline') return { accepted: false };
  const redis = getRedis();
  await redis.geoadd(`riders:geo:${rider.city}`, body.lng, body.lat);
  await redis.set(
    `rider:${rider._id}:loc`,
    JSON.stringify({ lat: body.lat, lng: body.lng, heading: body.heading ?? 0, ts: body.ts ?? Date.now() }),
    'EX',
    30,
  );
  rider.lastSeenAt = new Date();
  await rider.save();
  if (rider.currentShipmentId) {
    emitRoom(`shipment:${rider.currentShipmentId}`, 'rider:location', {
      shipmentId: String(rider.currentShipmentId),
      lat: body.lat,
      lng: body.lng,
      heading: body.heading ?? 0,
      ts: body.ts ?? Date.now(),
    });
    const key = String(rider._id);
    const prev = lastSample.get(key) ?? 0;
    if (Date.now() - prev > 20000) {
      lastSample.set(key, Date.now());
      await RiderLocationLog.create({
        riderId: rider._id,
        shipmentId: rider.currentShipmentId,
        location: { type: 'Point', coordinates: [body.lng, body.lat] },
        speed: body.speed,
        heading: body.heading,
        accuracy: body.accuracy,
        ts: new Date(body.ts ?? Date.now()),
      });
    }
  }
  return { accepted: true };
}

/**
 * Drop riders whose location key expired.
 */
export async function cleanupStaleRiders() {
  const online = await Rider.find({ availability: 'online' }).lean();
  const redis = getRedis();
  for (const rider of online) {
    const loc = await redis.get(`rider:${rider._id}:loc`);
    if (loc) continue;
    await Rider.updateOne({ _id: rider._id }, { availability: 'offline' });
    await redis.zrem(`riders:geo:${rider.city}`, String(rider._id));
  }
}

/**
 * @param {string} city
 */
export async function snapshotCity(city) {
  const riders = await Rider.find({ city, availability: { $in: ['online', 'busy'] } }).lean();
  const redis = getRedis();
  const points = [];
  for (const rider of riders) {
    const raw = await redis.get(`rider:${rider._id}:loc`);
    if (!raw) continue;
    const loc = JSON.parse(raw);
    points.push({ riderId: String(rider._id), ...loc, availability: rider.availability });
  }
  const active = await Shipment.find({ status: { $in: ['ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'ARRIVED'] } })
    .select('storeId status riderId')
    .limit(50)
    .lean();
  return { riders: points, shipments: active };
}
