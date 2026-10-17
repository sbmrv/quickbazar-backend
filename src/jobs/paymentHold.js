import { Queue, Worker } from 'bullmq';
import { createBullConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const queue = new Queue('payment-hold', { connection: createBullConnection() });

/**
 * Release stock if the online payment is still unpaid when the hold ends.
 * @param {string} orderId
 * @param {number} delayMinutes
 */
export async function schedulePaymentHold(orderId, delayMinutes) {
  await queue.add(
    'expire',
    { orderId },
    { delay: Math.max(1, delayMinutes) * 60 * 1000, jobId: `hold:${orderId}` },
  );
}

export function startPaymentHoldWorker() {
  const worker = new Worker(
    'payment-hold',
    async (job) => {
      const { expireUnpaidOrder } = await import('../modules/payments/service.js');
      await expireUnpaidOrder(job.data.orderId);
    },
    { connection: createBullConnection() },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'payment hold job failed');
  });
  return worker;
}
