import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { createPubSubPair } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { User } from '../modules/auth/model.js';
import { ACCESS_COOKIE } from '../modules/auth/cookies.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { Seller } from '../modules/sellers/model.js';
import { Shipment } from '../modules/orders/model.js';
import { bindIo } from './hub.js';

/**
 * Attach Socket.IO to the HTTP server and enable the Redis adapter.
 * Phase 0 only handles a ping/pong round-trip. Auth and rooms come later.
 * @param {import('node:http').Server} httpServer
 */
export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  const { pub, sub } = createPubSubPair();
  io.adapter(createAdapter(pub, sub));
  bindIo(io);

  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.cookie ?? '';
      const pair = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${ACCESS_COOKIE}=`));
      if (!pair) {
        next();
        return;
      }
      const token = decodeURIComponent(pair.slice(ACCESS_COOKIE.length + 1));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).lean();
      if (user && user.status === 'active') {
        socket.user = { id: String(user._id), roles: user.roles ?? [] };
        socket.join(`user:${user._id}`);
        if (user.roles?.includes('admin')) socket.join('admin:ops');
      }
      next();
    } catch {
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'socket connected');

    socket.on('store:join', async (storeId) => {
      if (!socket.user) return;
      const seller = await Seller.findOne({ userId: socket.user.id, status: 'approved' }).lean();
      if (!seller) return;
      const { Store } = await import('../modules/stores/model.js');
      const store = await Store.findOne({ _id: storeId, sellerId: seller._id }).lean();
      if (store) socket.join(`store:${store._id}`);
    });

    socket.on('shipment:join', async (shipmentId) => {
      if (!socket.user) return;
      const shipment = await Shipment.findById(shipmentId).select('buyerId sellerId').lean();
      if (!shipment) return;
      if (String(shipment.buyerId) === socket.user.id || socket.user.roles.includes('admin')) {
        socket.join(`shipment:${shipment._id}`);
      }
    });

    socket.on('rider:location', async (body) => {
      if (!socket.user) return;
      const { ingestLocation } = await import('../modules/riders/location.js');
      await ingestLocation(socket.user.id, body ?? {});
    });

    socket.on('ping', (payload, ack) => {
      const body = {
        ok: true,
        echoed: payload ?? null,
        serverTime: new Date().toISOString(),
      };
      if (typeof ack === 'function') ack(body);
      socket.emit('pong', body);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'socket disconnected');
    });
  });

  return io;
}
