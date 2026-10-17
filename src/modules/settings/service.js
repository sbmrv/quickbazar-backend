import { dropCache, readCache, writeCache } from '../../utils/cache.js';
import { writeAudit } from '../audit/service.js';
import { SETTING_KEYS, settingDefaults } from './defaults.js';
import { Setting } from './model.js';

const CACHE_TTL_SECONDS = 30 * 60;

/**
 * @param {string} key
 */
function cacheKey(key) {
  return `settings:${key}`;
}

/**
 * Typed getter. Missing documents fall back to the seeded defaults.
 * @param {keyof typeof settingDefaults} key
 */
export async function getSetting(key) {
  const cached = await readCache(cacheKey(key));
  if (cached) return cached;
  const doc = await Setting.findOne({ key }).lean();
  const value = doc?.value ?? settingDefaults[key];
  await writeCache(cacheKey(key), value, CACHE_TTL_SECONDS);
  return value;
}

export async function getAllSettings() {
  const entries = await Promise.all(SETTING_KEYS.map(async (key) => [key, await getSetting(key)]));
  return Object.fromEntries(entries);
}

/**
 * Replace one settings group and drop its cache.
 * @param {string} key
 * @param {unknown} value
 * @param {{ actorId: string, ip: string }} actor
 */
export async function updateSetting(key, value, actor) {
  const before = await getSetting(key);
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
  await dropCache([cacheKey(key)]);
  await writeAudit({
    actorId: actor.actorId,
    action: 'setting.update',
    entityType: 'Setting',
    entityId: key,
    before,
    after: value,
    ip: actor.ip,
  });
  return value;
}
