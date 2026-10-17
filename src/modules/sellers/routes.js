import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { validate } from '../../middlewares/validate.js';
import { uploadImageHandler } from '../uploads/controller.js';
import { uploadImage } from '../uploads/middleware.js';
import {
  createProductHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
  stockHandler,
  updateProductHandler,
} from '../products/controller.js';
import {
  createStoreHandler,
  deleteStoreHandler,
  listStoresHandler,
  updateStoreHandler,
} from '../stores/controller.js';
import { sellerTransition, listSellerShipments } from '../shipments/service.js';
import { requireApprovedSeller, requireSeller } from './access.js';
import { applyHandler, profileHandler, updateProfileHandler } from './controller.js';
import {
  applySchema,
  createProductSchema,
  createStoreSchema,
  listProductsSchema,
  productIdSchema,
  stockSchema,
  storeIdSchema,
  updateProductSchema,
  updateProfileSchema,
  updateStoreSchema,
} from './validation.js';

const router = Router();

router.use(requireAuth);
router.post('/apply', validate(applySchema), applyHandler);
router.get('/profile', profileHandler);
router.put('/profile', validate(updateProfileSchema), updateProfileHandler);

router.post('/uploads', uploadImage, uploadImageHandler);
router.get('/stores', requireSeller, listStoresHandler);
router.post('/stores', requireSeller, validate(createStoreSchema), createStoreHandler);
router.put('/stores/:id', requireSeller, validate(updateStoreSchema), updateStoreHandler);
router.delete('/stores/:id', requireSeller, validate(storeIdSchema), deleteStoreHandler);

router.get('/products', requireSeller, requireApprovedSeller, validate(listProductsSchema), listProductsHandler);
router.post('/products', requireSeller, requireApprovedSeller, validate(createProductSchema), createProductHandler);
router.get('/products/:id', requireSeller, requireApprovedSeller, validate(productIdSchema), getProductHandler);
router.put('/products/:id', requireSeller, requireApprovedSeller, validate(updateProductSchema), updateProductHandler);
router.patch(
  '/products/:id/stock',
  requireSeller,
  requireApprovedSeller,
  validate(stockSchema),
  stockHandler,
);
router.delete(
  '/products/:id',
  requireSeller,
  requireApprovedSeller,
  validate(productIdSchema),
  deleteProductHandler,
);

router.get('/orders', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await listSellerShipments(req.user.id));
});
router.post('/shipments/:id/accept', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await sellerTransition(req.user.id, req.params.id, 'ACCEPTED'));
});
router.post('/shipments/:id/reject', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await sellerTransition(req.user.id, req.params.id, 'REJECTED', String(req.body?.reason ?? '')));
});
router.post('/shipments/:id/packing', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await sellerTransition(req.user.id, req.params.id, 'PACKING'));
});
router.post('/shipments/:id/ready', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await sellerTransition(req.user.id, req.params.id, 'READY_FOR_PICKUP'));
});
router.get('/earnings', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { Seller } = await import('./model.js');
  const { sellerStatement } = await import('../ledger/service.js');
  const seller = await Seller.findOne({ userId: req.user.id, status: 'approved' }).lean();
  sendOk(res, seller ? await sellerStatement(String(seller._id)) : { balancePaise: 0, rows: [] });
});
router.post('/returns/:id/approve', requireSeller, requireApprovedSeller, async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { decideReturn } = await import('../engagement/service.js');
  sendOk(res, await decideReturn(req.params.id, true, req.user.id, 'seller'));
});

export default router;
