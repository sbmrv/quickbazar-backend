import { Router } from 'express';
import { actorFrom } from './http.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { listAuditHandler } from '../audit/controller.js';
import { listAuditSchema } from '../audit/validation.js';
import {
  adminCategories,
  createCategoryHandler,
  deleteCategoryHandler,
  updateCategoryHandler,
} from '../categories/controller.js';
import { categoryIdSchema, createCategorySchema, updateCategorySchema } from '../categories/validation.js';
import {
  createServiceAreaHandler,
  deleteServiceAreaHandler,
  listServiceAreasHandler,
  updateServiceAreaHandler,
} from '../serviceAreas/controller.js';
import {
  createServiceAreaSchema,
  serviceAreaIdSchema,
  updateServiceAreaSchema,
} from '../serviceAreas/validation.js';
import { listSettingsHandler, updateSettingHandler } from '../settings/controller.js';
import { updateSettingSchema } from '../settings/validation.js';
import { getAdminOrder, listAdminOrders } from '../orders/service.js';
import { adminTransition } from '../shipments/service.js';
import { listOrdersSchema } from '../checkout/validation.js';
import { uploadImageHandler } from '../uploads/controller.js';
import { uploadImage } from '../uploads/middleware.js';
import {
  approveProductHandler,
  moderationHandler,
  rejectProductHandler,
} from '../products/controller.js';
import {
  approveSellerHandler,
  getSellerHandler,
  listSellersHandler,
  patchSellerHandler,
  rejectSellerHandler,
  suspendSellerHandler,
} from '../sellers/controller.js';
import {
  approveSellerSchema,
  listSellersSchema,
  moderationSchema,
  patchSellerSchema,
  productIdSchema,
  reasonSchema,
  sellerIdSchema,
} from '../sellers/validation.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/categories', adminCategories);
router.post('/categories', validate(createCategorySchema), createCategoryHandler);
router.patch('/categories/:id', validate(updateCategorySchema), updateCategoryHandler);
router.delete('/categories/:id', validate(categoryIdSchema), deleteCategoryHandler);

router.get('/service-areas', listServiceAreasHandler);
router.post('/service-areas', validate(createServiceAreaSchema), createServiceAreaHandler);
router.patch('/service-areas/:id', validate(updateServiceAreaSchema), updateServiceAreaHandler);
router.delete('/service-areas/:id', validate(serviceAreaIdSchema), deleteServiceAreaHandler);

router.get('/settings', listSettingsHandler);
router.put('/settings/:key', validate(updateSettingSchema), updateSettingHandler);

router.get('/audit-logs', validate(listAuditSchema), listAuditHandler);
router.post('/uploads', uploadImage, uploadImageHandler);

router.get('/sellers', validate(listSellersSchema), listSellersHandler);
router.get('/sellers/:id', validate(sellerIdSchema), getSellerHandler);
router.patch('/sellers/:id', validate(patchSellerSchema), patchSellerHandler);
router.post('/sellers/:id/approve', validate(approveSellerSchema), approveSellerHandler);
router.post('/sellers/:id/reject', validate(reasonSchema), rejectSellerHandler);
router.post('/sellers/:id/suspend', validate(reasonSchema), suspendSellerHandler);

router.get('/products/moderation', validate(moderationSchema), moderationHandler);
router.post('/products/:id/approve', validate(productIdSchema), approveProductHandler);
router.post('/products/:id/reject', validate(reasonSchema), rejectProductHandler);

router.get('/orders', validate(listOrdersSchema), async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { rows, meta } = await listAdminOrders(req.validated.query);
  sendOk(res, rows, { meta });
});
router.get('/orders/:id', validate(sellerIdSchema), async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await getAdminOrder(req.validated.params.id));
});
router.post('/shipments/:id/status', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await adminTransition(req.params.id, String(req.body?.status ?? ''), String(req.body?.note ?? ''), actorFrom(req)));
});
router.post('/shipments/:id/cancel', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await adminTransition(req.params.id, 'CANCELLED', String(req.body?.reason ?? 'Cancelled by admin'), actorFrom(req)));
});
router.post('/shipments/:id/mark-delivered', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  sendOk(res, await adminTransition(req.params.id, 'DELIVERED', 'Marked delivered by admin', actorFrom(req)));
});
router.post('/shipments/:id/assign-rider', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { manualAssign } = await import('../riders/service.js');
  sendOk(res, await manualAssign(req.params.id, String(req.body?.riderId ?? '')));
});

router.get('/riders', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { listRiders } = await import('../riders/service.js');
  sendOk(res, await listRiders());
});
router.post('/riders/:id/approve', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { setRiderStatus } = await import('../riders/service.js');
  sendOk(res, await setRiderStatus(req.params.id, 'approved'));
});
router.post('/riders/:id/suspend', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { setRiderStatus } = await import('../riders/service.js');
  sendOk(res, await setRiderStatus(req.params.id, 'suspended'));
});
router.get('/payments', validate(listOrdersSchema), async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { listPayments } = await import('../payments/service.js');
  const { rows, meta } = await listPayments(req.validated.query);
  sendOk(res, rows, { meta });
});
router.post('/payments/:orderId/refund', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { refundIfPaid } = await import('../payments/service.js');
  sendOk(res, await refundIfPaid(req.params.orderId, String(req.body?.reason ?? 'Admin refund')));
});
router.get('/coupons', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { listCoupons } = await import('../coupons/service.js');
  sendOk(res, await listCoupons());
});
router.post('/coupons', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { saveCoupon } = await import('../coupons/service.js');
  sendOk(res, await saveCoupon(req.body), { status: 201 });
});
router.post('/banners', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { saveBanner } = await import('../engagement/service.js');
  sendOk(res, await saveBanner(req.body), { status: 201 });
});
router.post('/returns/:id/approve', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { decideReturn } = await import('../engagement/service.js');
  sendOk(res, await decideReturn(req.params.id, true, actorFrom(req).actorId, 'admin'));
});
router.post('/returns/:id/reject', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { decideReturn } = await import('../engagement/service.js');
  sendOk(res, await decideReturn(req.params.id, false, actorFrom(req).actorId, 'admin'));
});
router.get('/payouts', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { Payout } = await import('../ledger/model.js');
  sendOk(res, await Payout.find().sort({ createdAt: -1 }).limit(50).lean());
});
router.post('/payouts', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { createPayoutBatch } = await import('../ledger/service.js');
  sendOk(res, await createPayoutBatch(new Date(req.body.periodStart), new Date(req.body.periodEnd)), { status: 201 });
});
router.post('/payouts/:id/paid', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { setPayoutStatus } = await import('../ledger/service.js');
  sendOk(res, await setPayoutStatus(req.params.id, 'paid', String(req.body?.utr ?? '')));
});
router.post('/cod-remittances', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { recordRemittance } = await import('../ledger/service.js');
  sendOk(res, await recordRemittance(req.body.riderId, Number(req.body.amountPaise), actorFrom(req).actorId, String(req.body.note ?? '')), { status: 201 });
});
router.get('/analytics/summary', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { analyticsSummary } = await import('../analytics/service.js');
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86400000);
  sendOk(res, await analyticsSummary(from, to));
});
router.get('/live', async (req, res) => {
  const { sendOk } = await import('../../utils/apiResponse.js');
  const { snapshotCity } = await import('../riders/location.js');
  sendOk(res, await snapshotCity(String(req.query.city ?? 'Mumbai')));
});

export default router;
