import { readCache, writeCache } from '../../utils/cache.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const SEARCH_TTL = 24 * 60 * 60;
const REVERSE_TTL = 7 * 24 * 60 * 60;

/**
 * @param {string} path
 */
async function nominatim(path) {
  const response = await fetch(`https://nominatim.openstreetmap.org${path}`, {
    headers: { 'user-agent': env.NOMINATIM_USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new AppError('GEO_UNAVAILABLE', 'Address search is unavailable right now.', 502);
  return response.json();
}

/**
 * @param {number} lat
 * @param {number} lng
 */
export async function reverseGeocode(lat, lng) {
  const key = `geo:rev:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = await readCache(key);
  if (cached) return cached;
  const data = await nominatim(`/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
  const result = { label: data.display_name || 'Dropped pin' };
  await writeCache(key, result, REVERSE_TTL);
  return result;
}

/**
 * @param {string} q
 */
export async function searchAddress(q) {
  const key = `geo:search:${q.toLowerCase()}`;
  const cached = await readCache(key);
  if (cached) return cached;
  const data = await nominatim(`/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`);
  const result = (Array.isArray(data) ? data : []).map((row) => ({
    label: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
  }));
  await writeCache(key, result, SEARCH_TTL);
  return result;
}
