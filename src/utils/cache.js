import { getRedis } from '../config/redis.js';

/**
 * @param {string} key
 */
export async function readCache(key) {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} ttlSeconds
 */
export async function writeCache(key, value, ttlSeconds) {
  await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

/**
 * @param {string[]} keys
 */
export async function dropCache(keys) {
  if (keys.length === 0) return;
  await getRedis().del(...keys);
}
