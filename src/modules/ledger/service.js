import { AppError } from '../../utils/AppError.js';
import { Order } from '../orders/model.js';
import { Rider } from '../riders/model.js';
import { Seller } from '../sellers/model.js';
import { getSetting } from '../settings/service.js';
import { CodRemittance, LedgerEntry, Payout } from './model.js';

/**
 * Insert one ledger row. A duplicate (ref, type) is ignored.
 * @param {Record<string, unknown>} entry
 */
async function once(entry) {
  try {
    await LedgerEntry.create(entry);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) return;
    throw err;
  }
}

/**
 * Seller net, platform commission, and rider pay for a delivered shipment.
 * @param {Record<string, any>} shipment
 */
export async function postDeliveryLedger(shipment) {
  const seller = await Seller.findById(shipment.sellerId).lean();
  const settings = await getSetting('seller');
  const riderSettings = await getSetting('rider');
  const pct = seller?.commissionPct ?? settings.defaultCommissionPct;
  const items = shipment.items.reduce((sum, item) => sum + item.pricePaise * item.qty, 0);
  const commission = Math.round((items * pct) / 100);
  const net = items - commission;
  const riderPay = riderSettings.basePayPaise + Math.round((shipment.distanceKm ?? 0) * riderSettings.perKmPaise);
  const refId = String(shipment._id);
  await once({ accountType: 'seller', accountId: String(shipment.sellerId), direction: 'credit', amountPaise: net, type: 'seller_earning', refType: 'shipment', refId, note: '' });
  await once({ accountType: 'platform', accountId: 'platform', direction: 'credit', amountPaise: commission, type: 'commission', refType: 'shipment', refId, note: '' });
  if (shipment.riderId) {
    await once({ accountType: 'rider', accountId: String(shipment.riderId), direction: 'credit', amountPaise: riderPay, type: 'rider_earning', refType: 'shipment', refId, note: '' });
  }
  const order = await Order.findById(shipment.orderId).lean();
  if (order?.paymentMethod === 'COD' && shipment.riderId) {
    const cash = shipment.cod?.amountPaise ?? 0;
    await Rider.updateOne({ _id: shipment.riderId }, { $inc: { cashInHandPaise: cash } });
    await once({ accountType: 'rider', accountId: String(shipment.riderId), direction: 'debit', amountPaise: cash, type: 'cod_cash', refType: 'shipment', refId, note: 'Cash collected' });
  }
}

/**
 * Reverse seller earning and commission when a delivered shipment is refunded.
 * @param {Record<string, any>} shipment
 */
export async function reverseDeliveryLedger(shipment) {
  const rows = await LedgerEntry.find({ refType: 'shipment', refId: String(shipment._id), type: { $in: ['seller_earning', 'commission', 'rider_earning'] } }).lean();
  for (const row of rows) {
    await once({
      accountType: row.accountType,
      accountId: row.accountId,
      direction: row.direction === 'credit' ? 'debit' : 'credit',
      amountPaise: row.amountPaise,
      type: `${row.type}_reversal`,
      refType: 'shipment',
      refId: String(shipment._id),
      note: 'Refund',
    });
  }
}

/**
 * @param {'seller' | 'rider' | 'platform'} accountType
 * @param {string} accountId
 */
export async function balancePaise(accountType, accountId) {
  const rows = await LedgerEntry.find({ accountType, accountId }).lean();
  return rows.reduce((sum, row) => sum + (row.direction === 'credit' ? row.amountPaise : -row.amountPaise), 0);
}

/**
 * @param {string} sellerId
 */
export async function sellerStatement(sellerId) {
  const rows = await LedgerEntry.find({ accountType: 'seller', accountId: sellerId }).sort({ createdAt: -1 }).limit(100).lean();
  return { balancePaise: await balancePaise('seller', sellerId), rows };
}

/**
 * @param {Date} periodStart
 * @param {Date} periodEnd
 */
export async function createPayoutBatch(periodStart, periodEnd) {
  const sellers = await Seller.find({ status: 'approved' }).select('_id').lean();
  const created = [];
  for (const seller of sellers) {
    const amount = await balancePaise('seller', String(seller._id));
    const paid = await Payout.aggregate([
      { $match: { accountId: seller._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]);
    const due = amount - (paid[0]?.total ?? 0);
    if (due <= 0) continue;
    const payout = await Payout.create({ accountType: 'seller', accountId: seller._id, amountPaise: due, periodStart, periodEnd });
    created.push(payout);
  }
  return created;
}

/**
 * @param {string} payoutId
 * @param {string} status
 * @param {string} [utr]
 */
export async function setPayoutStatus(payoutId, status, utr = '') {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new AppError('NOT_FOUND', 'Payout not found.', 404);
  payout.status = status;
  if (utr) payout.utr = utr;
  if (status === 'paid') {
    await once({
      accountType: payout.accountType,
      accountId: String(payout.accountId),
      direction: 'debit',
      amountPaise: payout.amountPaise,
      type: 'payout',
      refType: 'payout',
      refId: String(payout._id),
      note: utr,
    });
  }
  await payout.save();
  return payout;
}

/**
 * @param {string} riderId
 * @param {number} amountPaise
 * @param {string} receivedBy
 * @param {string} note
 */
export async function recordRemittance(riderId, amountPaise, receivedBy, note) {
  const rider = await Rider.findById(riderId);
  if (!rider) throw new AppError('NOT_FOUND', 'Rider not found.', 404);
  if (amountPaise > rider.cashInHandPaise) throw new AppError('COD_AMOUNT', 'Deposit is larger than cash in hand.', 400);
  rider.cashInHandPaise -= amountPaise;
  await rider.save();
  await once({
    accountType: 'rider',
    accountId: String(rider._id),
    direction: 'credit',
    amountPaise,
    type: 'cod_remittance',
    refType: 'remittance',
    refId: `${rider._id}:${Date.now()}`,
    note,
  });
  return CodRemittance.create({ riderId, amountPaise, receivedBy, note });
}
