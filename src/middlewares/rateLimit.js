import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';

function buildLimiter(windowMs, limit) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(res, {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again later.',
      });
    },
  });
}

export const authRateLimit = buildLimiter(15 * 60 * 1000, 60);
export const publicReadLimit = buildLimiter(60 * 1000, 120);
