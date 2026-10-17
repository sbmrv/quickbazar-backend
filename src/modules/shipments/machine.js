const SELLER = {
  PLACED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PACKING'],
  PACKING: ['READY_FOR_PICKUP'],
};

const BUYER = {
  PLACED: ['CANCELLED'],
  ACCEPTED: ['CANCELLED'],
};

const SYSTEM = {
  PLACED: ['REJECTED'],
  PAYMENT_PENDING: ['PLACED', 'CANCELLED'],
};

const RIDER = {
  READY_FOR_PICKUP: ['PICKED_UP'],
  PICKED_UP: ['ARRIVED', 'DELIVERED', 'DELIVERY_FAILED'],
  ARRIVED: ['DELIVERED', 'DELIVERY_FAILED'],
};

const RETURN_FLOW = {
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'RETURN_REJECTED'],
  RETURN_APPROVED: ['RETURNED'],
};

const ADMIN = ['CANCELLED', 'DELIVERED', 'REJECTED', 'ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'RETURN_APPROVED', 'RETURNED'];
const TERMINAL = new Set(['REJECTED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED', 'RETURN_REJECTED']);

/**
 * @param {string} from
 * @param {string} to
 * @param {'seller' | 'buyer' | 'admin' | 'system' | 'rider'} actor
 */
export function canTransition(from, to, actor) {
  if (TERMINAL.has(from) || from === to) return false;
  if ((RETURN_FLOW[from] ?? []).includes(to)) {
    if (to === 'RETURN_REQUESTED') return actor === 'buyer' || actor === 'admin';
    return actor === 'seller' || actor === 'admin';
  }
  if (actor === 'admin') return ADMIN.includes(to);
  const table = actor === 'seller' ? SELLER : actor === 'buyer' ? BUYER : actor === 'rider' ? RIDER : SYSTEM;
  return (table[from] ?? []).includes(to);
}

/**
 * @param {string[]} statuses
 */
export function deriveOrderStatus(statuses) {
  if (statuses.length === 0) return 'PLACED';
  if (statuses.every((status) => status === 'DELIVERED')) return 'COMPLETED';
  if (statuses.every((status) => status === 'CANCELLED' || status === 'REJECTED')) return 'CANCELLED';
  if (statuses.some((status) => !['PLACED', 'CANCELLED', 'REJECTED'].includes(status))) return 'IN_PROGRESS';
  return 'PLACED';
}
