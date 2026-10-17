import { Router } from 'express';
import { publicReadLimit } from '../../middlewares/rateLimit.js';
import { validate } from '../../middlewares/validate.js';
import { sendOk } from '../../utils/apiResponse.js';
import { discoveryHome, discoveryProduct, discoveryProducts, checkServiceability } from './service.js';
import { homeSchema, listDiscoverySchema, productDiscoverySchema, serviceabilitySchema } from './validation.js';

const router = Router();

router.get('/serviceability', publicReadLimit, validate(serviceabilitySchema), async (req, res) => {
  sendOk(res, await checkServiceability(req.validated.query.lng, req.validated.query.lat));
});

router.get('/home', publicReadLimit, validate(homeSchema), async (req, res) => {
  sendOk(res, await discoveryHome(req.validated.query));
});

router.get('/products', publicReadLimit, validate(listDiscoverySchema), async (req, res) => {
  const { rows, meta, ...rest } = await discoveryProducts(req.validated.query);
  sendOk(res, { ...rest, products: rows }, { meta });
});

router.get('/products/:id', publicReadLimit, validate(productDiscoverySchema), async (req, res) => {
  sendOk(res, await discoveryProduct(req.validated.params.id, req.validated.query));
});

export default router;
