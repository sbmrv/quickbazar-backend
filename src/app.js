import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { uploadsDir } from './config/paths.js';
import healthRoutes from './modules/health/routes.js';
import authRoutes from './modules/auth/routes.js';
import categoryRoutes from './modules/categories/routes.js';
import adminRoutes from './modules/admin/routes.js';
import sellerRoutes from './modules/sellers/routes.js';
import discoveryRoutes from './modules/discovery/routes.js';
import geoRoutes from './modules/geo/routes.js';
import { mountCommerce } from './modules/buyer/routes.js';
import riderRoutes from './modules/riders/routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org', 'https://res.cloudinary.com'],
          connectSrc: ["'self'", env.CLIENT_URL, 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.post('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res, next) => {
    try {
      const { handleWebhook } = await import('./modules/payments/service.js');
      const { sendOk } = await import('./utils/apiResponse.js');
      sendOk(res, await handleWebhook(req.body, req.get('x-razorpay-signature')));
    } catch (err) {
      next(err);
    }
  });
  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  app.use('/uploads', express.static(uploadsDir));
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/categories', categoryRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/seller', sellerRoutes);
  app.use('/api/v1/rider', riderRoutes);
  app.use('/api/v1/discovery', discoveryRoutes);
  app.use('/api/v1/geo', geoRoutes);
  mountCommerce(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
