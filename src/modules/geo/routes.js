import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middlewares/validate.js';
import { sendError, sendOk } from '../../utils/apiResponse.js';
import { serviceabilitySchema, searchSchema } from '../discovery/validation.js';
import { reverseGeocode, searchAddress } from './service.js';

const geoLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, { status: 429, code: 'RATE_LIMITED', message: 'Too many address lookups. Try again shortly.' });
  },
});

const router = Router();

router.get('/reverse', geoLimit, validate(serviceabilitySchema), async (req, res) => {
  sendOk(res, await reverseGeocode(req.validated.query.lat, req.validated.query.lng));
});

router.get('/search', geoLimit, validate(searchSchema), async (req, res) => {
  sendOk(res, await searchAddress(req.validated.query.q));
});

export default router;
