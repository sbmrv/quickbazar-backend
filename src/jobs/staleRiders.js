import { Queue, Worker } from 'bullmq';
import { createBullConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const queue = new Queue('stale-riders', { connection: createBullConnection() });

export function startStaleRiderWorker() {
  const worker = new Worker(
    'stale-riders',
    async () => {
      const { cleanupStaleRiders } = await import('../modules/riders/location.js');
      await cleanupStaleRiders();
    },
    { connection: createBullConnection() },
  );
  queue.add('sweep', {}, { repeat: { every: 60_000 }, jobId: 'stale-riders' }).catch(() => {});
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'stale rider job failed'));
  return worker;
}
