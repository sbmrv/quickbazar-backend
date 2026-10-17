import { Queue, Worker } from 'bullmq';
import { createBullConnection, getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { notifyUser } from '../modules/notifications/service.js';
import { Shipment } from '../modules/orders/model.js';
import { Rider } from '../modules/riders/model.js';
import { getSetting } from '../modules/settings/service.js';
import { Store } from '../modules/stores/model.js';
import { emitRoom } from '../sockets/hub.js';

const queue = new Queue('assignment', { connection: createBullConnection() });

/**
 * @param {string} shipmentId
 */
export async function enqueueAssignment(shipmentId) {
  await queue.add('offer', { shipmentId, step: 0, cursor: 0 }, { jobId: `assign:${shipmentId}:0:0` });
}

export function startAssignmentWorker() {
  const worker = new Worker(
    'assignment',
    async (job) => {
      if (job.name === 'expire') await expireOffer(job.data);
      else await offerNext(job.data);
    },
    { connection: createBullConnection() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'assignment job failed'));
  return worker;
}

/**
 * @param {{ shipmentId: string, step: number, cursor: number }} data
 */
async function offerNext(data) {
  const shipment = await Shipment.findById(data.shipmentId);
  if (!shipment || shipment.riderId || !['ACCEPTED', 'PACKING', 'READY_FOR_PICKUP'].includes(shipment.status)) return;
  const settings = await getSetting('rider');
  const steps = settings.offerRadiusKmSteps ?? [2, 4, 6];
  if (data.step >= steps.length) {
    shipment.assignment = { ...(shipment.assignment ?? {}), state: 'UNASSIGNED' };
    await shipment.save();
    emitRoom('admin:ops', 'shipment:status', { shipmentId: String(shipment._id), status: 'UNASSIGNED' });
    return;
  }
  const store = await Store.findById(shipment.storeId).lean();
  if (!store) return;
  const redis = getRedis();
  const nearby = await redis.geosearch(
    `riders:geo:${store.city}`,
    'FROMLONLAT',
    store.location.coordinates[0],
    store.location.coordinates[1],
    'BYRADIUS',
    steps[data.step],
    'km',
    'ASC',
    'COUNT',
    5,
  );
  const offered = new Set((shipment.assignment?.offers ?? []).map((row) => String(row.riderId)));
  let chosen = null;
  for (const riderId of nearby) {
    if (offered.has(String(riderId))) continue;
    const rider = await Rider.findOne({ _id: riderId, availability: 'online', status: 'approved' });
    if (rider) {
      chosen = rider;
      break;
    }
  }
  if (!chosen) {
    await queue.add('offer', { shipmentId: data.shipmentId, step: data.step + 1, cursor: 0 }, { jobId: `assign:${data.shipmentId}:${data.step + 1}` });
    return;
  }
  const expiresAt = new Date(Date.now() + (settings.offerTimeoutSec ?? 25) * 1000);
  const offers = [...(shipment.assignment?.offers ?? []), { riderId: chosen._id, offeredAt: new Date(), expiresAt, response: 'pending' }];
  shipment.assignment = { state: 'OFFERED', offers };
  await shipment.save();
  emitRoom(`user:${chosen.userId}`, 'rider:offer', {
    shipmentId: String(shipment._id),
    storeId: String(shipment.storeId),
    distanceKm: shipment.distanceKm,
    expiresAt: expiresAt.toISOString(),
    earningPaise: settings.basePayPaise + Math.round(shipment.distanceKm * settings.perKmPaise),
  });
  await queue.add(
    'expire',
    { shipmentId: data.shipmentId, riderId: String(chosen._id), step: data.step },
    { delay: (settings.offerTimeoutSec ?? 25) * 1000, jobId: `offer:${shipment._id}:${chosen._id}` },
  );
}

/**
 * @param {{ shipmentId: string, riderId: string, step: number }} data
 */
async function expireOffer(data) {
  const shipment = await Shipment.findById(data.shipmentId);
  if (!shipment || shipment.riderId) return;
  const offers = shipment.assignment?.offers ?? [];
  const offer = offers.find((row) => String(row.riderId) === data.riderId && row.response === 'pending');
  if (!offer) return;
  offer.response = 'timeout';
  shipment.assignment = { state: 'OFFERED', offers };
  shipment.markModified('assignment');
  await shipment.save();
  const rider = await Rider.findById(data.riderId).lean();
  if (rider) emitRoom(`user:${rider.userId}`, 'rider:offer:expired', { shipmentId: data.shipmentId });
  await notifyUser(rider?.userId, { title: 'Offer expired', body: 'Looking for another rider.', refType: 'shipment', refId: data.shipmentId }).catch(() => {});
  await queue.add('offer', { shipmentId: data.shipmentId, step: data.step, cursor: 0 }, { jobId: `assign:${data.shipmentId}:${data.step}:next:${data.riderId}` });
}

/**
 * @param {string} userId
 * @param {string} shipmentId
 * @param {boolean} accept
 */
export async function respondToOffer(userId, shipmentId, accept) {
  const rider = await Rider.findOne({ userId, status: 'approved' });
  if (!rider) return null;
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) return null;
  const offers = shipment.assignment?.offers ?? [];
  const offer = [...offers].reverse().find((row) => String(row.riderId) === String(rider._id) && row.response === 'pending');
  if (!offer) return shipment;
  offer.response = accept ? 'accepted' : 'rejected';
  if (accept) {
    shipment.riderId = rider._id;
    shipment.assignment = { state: 'ASSIGNED', offers };
    rider.availability = 'busy';
    rider.currentShipmentId = shipment._id;
    await rider.save();
  } else {
    shipment.assignment = { state: 'OFFERED', offers };
  }
  shipment.markModified('assignment');
  await shipment.save();
  if (!accept) {
    await queue.add('offer', { shipmentId, step: 0, cursor: 0 }, { jobId: `assign:${shipmentId}:reject:${rider._id}` });
  }
  return shipment;
}
