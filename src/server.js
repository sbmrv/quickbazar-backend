import http from 'node:http';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { closeRedis, connectRedis } from './config/redis.js';
import { createApp } from './app.js';
import { startAssignmentWorker } from './jobs/assignment.js';
import { startPaymentHoldWorker } from './jobs/paymentHold.js';
import { startSellerAcceptWorker } from './jobs/sellerAccept.js';
import { startStaleRiderWorker } from './jobs/staleRiders.js';
import { attachSocket } from './sockets/io.js';
import { logger } from './utils/logger.js';

const app = createApp();
const httpServer = http.createServer(app);
const io = attachSocket(httpServer);

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
  await closeRedis();
  await disconnectDb();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    logger.error({ err }, 'shutdown failed');
    process.exit(1);
  });
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    logger.error({ err }, 'shutdown failed');
    process.exit(1);
  });
});

await connectDb();
await connectRedis();
startSellerAcceptWorker();
startPaymentHoldWorker();
startAssignmentWorker();
startStaleRiderWorker();

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'api listening');
});
