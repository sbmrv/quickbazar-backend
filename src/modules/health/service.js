import mongoose from 'mongoose';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

/**
 * Check MongoDB and Redis reachability for the public health endpoint.
 * @returns {Promise<{ mongo: 'up' | 'down', redis: 'up' | 'down' }>}
 */
export async function getHealth() {
  const report = {
    mongo: /** @type {'up' | 'down'} */ ('down'),
    redis: /** @type {'up' | 'down'} */ ('down'),
  };

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().command({ ping: 1 });
      report.mongo = 'up';
    }
  } catch (err) {
    logger.warn({ err }, 'mongo health check failed');
  }

  try {
    const reply = await getRedis().ping();
    if (reply === 'PONG') report.redis = 'up';
  } catch (err) {
    logger.warn({ err }, 'redis health check failed');
  }

  return report;
}
