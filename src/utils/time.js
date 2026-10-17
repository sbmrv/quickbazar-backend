import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const ZONE = 'Asia/Kolkata';

/**
 * @param {dayjs.Dayjs} [now]
 */
export function nowIst(now = dayjs()) {
  return now.tz(ZONE);
}

/**
 * Store hours are same-day windows. Day 0 is Sunday.
 * @param {{ day: number, open: string, close: string }[]} hours
 * @param {dayjs.Dayjs} [now]
 */
export function isOpenAt(hours, now = nowIst()) {
  const clock = now.format('HH:mm');
  const row = (hours ?? []).find((hour) => hour.day === now.day());
  if (!row) return false;
  return clock >= row.open && clock < row.close;
}

/**
 * @param {string} cutoff HH:mm
 * @param {dayjs.Dayjs} [now]
 */
export function beforeCutoff(cutoff, now = nowIst()) {
  return now.format('HH:mm') < cutoff;
}
