import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/** @type {Set<Redis>} */
const clients = new Set();

/**
 * @param {Redis} client
 * @param {string} name
 */
function watch(client, name) {
  clients.add(client);
  client.on('error', (err) => {
    logger.error({ err, name }, 'redis client error');
  });
  return client;
}

/** @type {Redis | null} */
let shared = null;

/**
 * Shared ioredis client for cache, OTP, and health checks.
 * @returns {Redis}
 */
export function getRedis() {
  if (!shared) {
    shared = watch(
      new Redis(env.REDIS_URL, {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 2,
      }),
      'shared',
    );
  }
  return shared;
}

/**
 * Dedicated connection for BullMQ. BullMQ requires maxRetriesPerRequest: null.
 * @returns {Redis}
 */
export function createBullConnection() {
  return watch(
    new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }),
    'bullmq',
  );
}

/**
 * Pub/sub pair for the Socket.IO Redis adapter. Do not reuse the shared client.
 * @returns {{ pub: Redis, sub: Redis }}
 */
export function createPubSubPair() {
  const pub = watch(new Redis(env.REDIS_URL, { connectTimeout: 5000 }), 'socket-pub');
  const sub = watch(pub.duplicate(), 'socket-sub');
  return { pub, sub };
}

/**
 * Open the shared Redis connection and confirm it answers PING.
 */
export async function connectRedis() {
  const redis = getRedis();
  if (redis.status === 'wait') await redis.connect();
  const reply = await redis.ping();
  if (reply !== 'PONG') throw new Error('Redis PING failed');
  logger.info('redis connected');
}

export async function closeRedis() {
  await Promise.all(
    [...clients].map(async (client) => {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }),
  );
  clients.clear();
  shared = null;
}
