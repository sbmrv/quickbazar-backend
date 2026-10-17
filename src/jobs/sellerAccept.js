import { Queue, Worker } from 'bullmq';
import { createBullConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { timeoutReject } from '../modules/shipments/service.js';

const queue = new Queue('seller-accept', { connection: createBullConnection() });

/**
 * @param {string} shipmentId
 * @param {number} delaySec
 */
export async function scheduleSellerAccept(shipmentId, delaySec) {
  await queue.add('timeout', { shipmentId }, { delay: Math.max(1, delaySec) * 1000, jobId: `accept:${shipmentId}` });
}

export function startSellerAcceptWorker() {
  const worker = new Worker(
    'seller-accept',
    async (job) => {
      await timeoutReject(job.data.shipmentId);
    },
    { connection: createBullConnection() },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'seller accept job failed');
  });
  return worker;
}
