import { getRedis } from '../../config/redis.js';
import { Order, Shipment } from '../orders/model.js';

/**
 * @param {Date} from
 * @param {Date} to
 */
export async function analyticsSummary(from, to) {
  const key = `analytics:${from.toISOString()}:${to.toISOString()}`;
  const redis = getRedis();
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const match = { createdAt: { $gte: from, $lte: to }, paymentStatus: { $nin: ['failed', 'expired'] } };
  const [orders, gmvRow, cities, reasons, tops] = await Promise.all([
    Order.countDocuments(match),
    Order.aggregate([{ $match: match }, { $group: { _id: null, gmv: { $sum: '$pricing.grandTotal' } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$addressSnapshot.city', orders: { $sum: 1 } } }]),
    Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: { $in: ['CANCELLED', 'REJECTED'] } } },
      { $group: { _id: '$cancelReason', count: { $sum: 1 } } },
    ]),
    Shipment.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, status: 'DELIVERED' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.qty' } } },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
  ]);
  const delivered = await Shipment.find({ deliveredAt: { $gte: from, $lte: to }, status: 'DELIVERED' }).select('createdAt deliveredAt etaMinutesPromised').lean();
  const minutes = delivered.map((row) => (row.deliveredAt - row.createdAt) / 60000);
  const onTime = delivered.filter((row) => (row.deliveredAt - row.createdAt) / 60000 <= (row.etaMinutesPromised || 0)).length;
  const gmv = gmvRow[0]?.gmv ?? 0;
  const summary = {
    gmvPaise: gmv,
    orders,
    aovPaise: orders ? Math.round(gmv / orders) : 0,
    deliveryMinutes: minutes,
    onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
    cancellations: reasons,
    topProducts: tops,
    cities,
  };
  await redis.set(key, JSON.stringify(summary), 'EX', 60);
  return summary;
}
