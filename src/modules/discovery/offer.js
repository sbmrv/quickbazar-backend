import { beforeCutoff, isOpenAt, nowIst } from '../../utils/time.js';

const MODE_ORDER = ['EXPRESS', 'SAME_DAY', 'STANDARD'];

/**
 * @param {number} distanceKm
 * @param {{ roadFactor: number, avgSpeedKmph: number }} delivery
 */
export function travelMinutes(distanceKm, delivery) {
  if (delivery.avgSpeedKmph <= 0) return 0;
  return Math.ceil((distanceKm * delivery.roadFactor) / delivery.avgSpeedKmph * 60);
}

/**
 * Express ETA from section 6.3. Same-day sorts after express. Standard sorts as next day.
 * @param {{ mode: string, distanceKm: number, prepTimeMin: number, busyExtraMin: number, handlingTimeMin: number, delivery: { roadFactor: number, avgSpeedKmph: number, assignBufferMin: number } }} input
 */
export function etaForMode(input) {
  const travel = travelMinutes(input.distanceKm, input.delivery);
  const prep = Math.max(input.prepTimeMin + (input.busyExtraMin ?? 0), input.handlingTimeMin);
  if (input.mode === 'STANDARD') {
    const etaMinutes = 24 * 60 + travel;
    return { etaMinutes, label: '1–3 days' };
  }
  if (input.mode === 'SAME_DAY') {
    const etaMinutes = Math.max(120, prep + travel);
    return { etaMinutes, label: 'Today' };
  }
  const etaMinutes = prep + input.delivery.assignBufferMin + travel;
  return { etaMinutes, label: `${etaMinutes}–${etaMinutes + 5} min` };
}

/**
 * @param {{ mode: string, distanceKm: number, itemTotalPaise: number, settings: { modes: any, fees: any } }} input
 */
export function deliveryFeePaise(input) {
  const { fees } = input.settings;
  if (input.mode === 'EXPRESS') {
    const extraKm = Math.max(0, input.distanceKm - 2);
    const perKm = input.settings.modes.express.perKmAfter2kmPaise;
    return input.settings.modes.express.baseFeePaise + Math.round(extraKm * perKm);
  }
  const base =
    input.mode === 'SAME_DAY'
      ? input.settings.modes.sameDay.baseFeePaise
      : Math.min(input.settings.modes.standard.baseFeePaise, input.settings.modes.standard.maxBaseFeePaise);
  if (input.itemTotalPaise >= fees.freeDeliveryAbovePaise) return 0;
  return base;
}

/**
 * @param {Record<string, any>} product
 */
export function availableUnits(product, sku) {
  const variant = product.variants.find((item) => item.sku === sku);
  if (!variant) return 0;
  return Math.max(0, variant.stock - (variant.reservedStock ?? 0));
}

/**
 * @param {Record<string, any>} product
 * @param {Record<string, any>} store
 * @param {number} distanceKm
 * @param {{ delivery: any, modes: any }} settings
 * @param {import('dayjs').Dayjs} [now]
 */
export function availableModes(product, store, distanceKm, settings, now = nowIst()) {
  const open = Boolean(store.isOpen && store.acceptingOrders && store.status === 'active' && isOpenAt(store.hours, now));
  const handling = product.handlingTimeMin ?? 0;
  const modes = [];

  const expressLimit = Math.min(
    store.radiusKm?.express ?? 0,
    settings.modes.express.maxRadiusKm,
    product.maxExpressDistanceKm ?? Infinity,
  );
  if (settings.modes.express.enabled && product.delivery?.express && open && distanceKm <= expressLimit) {
    const eta = etaForMode({
      mode: 'EXPRESS',
      distanceKm,
      prepTimeMin: store.prepTimeMin,
      busyExtraMin: store.busyExtraMin,
      handlingTimeMin: handling,
      delivery: settings.delivery,
    });
    modes.push({ mode: 'EXPRESS', ...eta, radiusKm: expressLimit });
  }

  const sameLimit = Math.min(store.radiusKm?.sameDay ?? 0, settings.modes.sameDay.maxRadiusKm);
  if (
    settings.modes.sameDay.enabled &&
    product.delivery?.sameDay &&
    open &&
    distanceKm <= sameLimit &&
    beforeCutoff(settings.modes.sameDay.cutoff, now)
  ) {
    const eta = etaForMode({
      mode: 'SAME_DAY',
      distanceKm,
      prepTimeMin: store.prepTimeMin,
      busyExtraMin: store.busyExtraMin,
      handlingTimeMin: handling,
      delivery: settings.delivery,
    });
    modes.push({ mode: 'SAME_DAY', ...eta, radiusKm: sameLimit, slots: settings.modes.sameDay.slots });
  }

  const standardLimit = store.radiusKm?.standard ?? 0;
  if (settings.modes.standard.enabled && product.delivery?.standard && open && distanceKm <= standardLimit) {
    const eta = etaForMode({
      mode: 'STANDARD',
      distanceKm,
      prepTimeMin: store.prepTimeMin,
      busyExtraMin: store.busyExtraMin,
      handlingTimeMin: handling,
      delivery: settings.delivery,
    });
    modes.push({ mode: 'STANDARD', ...eta, radiusKm: standardLimit });
  }

  modes.sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) || a.etaMinutes - b.etaMinutes);
  return modes;
}

/**
 * Fastest mode is the one with the smallest ETA, which puts express ahead of same-day and standard.
 * @param {{ mode: string, etaMinutes: number }[]} modes
 */
export function fastestMode(modes) {
  return [...modes].sort((a, b) => a.etaMinutes - b.etaMinutes || MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode))[0] ?? null;
}

/**
 * @param {Array<{ etaMinutes: number, distanceKm: number, ratingAvg: number, createdAt: Date | string }>} rows
 */
export function rankFastest(rows) {
  return [...rows].sort((a, b) => {
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    if ((b.ratingAvg ?? 0) !== (a.ratingAvg ?? 0)) return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
