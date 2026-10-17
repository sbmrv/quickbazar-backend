import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * @param {string} ttl Examples: 15m, 30d.
 * @returns {number} Seconds.
 */
export function ttlToSeconds(ttl) {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid ttl: ${ttl}`);
  return Number(match[1]) * UNITS[match[2]];
}

/**
 * @param {string} userId
 * @param {string} tokenId
 */
export function refreshKey(userId, tokenId) {
  return `refresh:${userId}:${tokenId}`;
}

/**
 * @param {string} userId
 */
export function signAccessToken(userId) {
  return jwt.sign({ sub: userId, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

/**
 * @param {string} userId
 * @param {string} tokenId
 */
export function signRefreshToken(userId, tokenId) {
  return jwt.sign({ sub: userId, tid: tokenId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  });
}

/**
 * @param {string} token
 */
export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return payload;
}

/**
 * @param {string} token
 */
export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.tid !== 'string') {
    throw new Error('Invalid refresh token');
  }
  return payload;
}

/**
 * Drop the presented refresh id and allowlist the next one.
 * A missing or already-used id returns null so the caller can reject the session.
 * @param {{ del: (key: string) => Promise<number>, setEx: (key: string, ttlSeconds: number, value: string) => Promise<unknown> }} store
 * @param {{ userId: string, tokenId: string, nextTokenId: string, ttlSeconds: number }} input
 * @returns {Promise<string | null>}
 */
export async function rotateAllowlist(store, input) {
  const removed = await store.del(refreshKey(input.userId, input.tokenId));
  if (removed !== 1) return null;
  await store.setEx(refreshKey(input.userId, input.nextTokenId), input.ttlSeconds, '1');
  return input.nextTokenId;
}
