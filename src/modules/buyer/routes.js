import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { publicReadLimit } from '../../middlewares/rateLimit.js';
import { validate } from '../../middlewares/validate.js';
import { AppError } from '../../utils/AppError.js';
import { sendOk } from '../../utils/apiResponse.js';
import { createAddress, deleteAddress, listAddresses, updateAddress } from '../addresses/service.js';
import { clearCart, readCart, saveCart } from '../cart/service.js';
import {
  addressIdSchema,
  createAddressSchema,
  getCartSchema,
  listOrdersSchema,
  placeOrderSchema,
  putCartSchema,
  quoteSchema,
  updateAddressSchema,
} from '../checkout/validation.js';
import { waitlistSchema } from '../discovery/validation.js';
import { joinWaitlist } from '../discovery/waitlist.js';
import { listNotifications, markRead } from '../notifications/service.js';
import { buildQuote, getOrder, listOrders, placeOrder } from '../orders/service.js';
import { buyerCancel } from '../shipments/service.js';

const waitlist = Router();
waitlist.post('/', publicReadLimit, validate(waitlistSchema), async (req, res) => {
  sendOk(res, await joinWaitlist(req.validated.body), { status: 201 });
});

const addresses = Router();
addresses.use(requireAuth);
addresses.get('/', async (req, res) => sendOk(res, await listAddresses(req.user.id)));
addresses.post('/', validate(createAddressSchema), async (req, res) => {
  sendOk(res, await createAddress(req.user.id, req.validated.body), { status: 201 });
});
addresses.put('/:id', validate(updateAddressSchema), async (req, res) => {
  sendOk(res, await updateAddress(req.user.id, req.validated.params.id, req.validated.body));
});
addresses.delete('/:id', validate(addressIdSchema), async (req, res) => {
  sendOk(res, await deleteAddress(req.user.id, req.validated.params.id));
});

const cart = Router();
cart.use(requireAuth);
cart.get('/', validate(getCartSchema), async (req, res) => {
  const view = await readCart(req.user.id, req.validated.query.lng, req.validated.query.lat);
  sendOk(res, { items: view.items, issues: view.issues, shipments: view.shipments, pricing: view.pricing });
});
cart.put('/', validate(putCartSchema), async (req, res) => {
  await saveCart(req.user.id, req.validated.body.items);
  const view = await readCart(req.user.id, req.validated.query.lng, req.validated.query.lat);
  sendOk(res, { items: view.items, issues: view.issues, shipments: view.shipments, pricing: view.pricing });
});
cart.delete('/', async (req, res) => sendOk(res, await clearCart(req.user.id)));

const checkout = Router();
checkout.use(requireAuth);
checkout.post('/quote', validate(quoteSchema), async (req, res) => {
  sendOk(res, await buildQuote(req.user.id, req.validated.body));
});

const orders = Router();
orders.use(requireAuth);
orders.get('/', validate(listOrdersSchema), async (req, res) => {
  const { rows, meta } = await listOrders(req.user.id, req.validated.query);
  sendOk(res, rows, { meta });
});
orders.get('/:id', validate(addressIdSchema), async (req, res) => {
  sendOk(res, await getOrder(req.user.id, req.validated.params.id));
});
orders.post('/', validate(placeOrderSchema), async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key || key.length < 8 || key.length > 100) {
    throw new AppError('IDEMPOTENCY_KEY', 'Send an Idempotency-Key header.', 400);
  }
  sendOk(res, await placeOrder(req.user.id, req.validated.body, key), { status: 201 });
});
orders.post('/:id/cancel', validate(addressIdSchema), async (req, res) => {
  sendOk(res, await buyerCancel(req.user.id, req.validated.params.id, 'Cancelled by buyer'));
});

const notifications = Router();
notifications.use(requireAuth);
notifications.get('/', async (req, res) => sendOk(res, await listNotifications(req.user.id)));
notifications.post('/:id/read', async (req, res) => sendOk(res, await markRead(req.user.id, req.params.id)));

orders.post('/:id/reorder', validate(addressIdSchema), async (req, res) => {
  const { reorder } = await import('../engagement/service.js');
  sendOk(res, await reorder(req.user.id, req.validated.params.id));
});
orders.post('/:id/reviews', async (req, res) => {
  const { addReview } = await import('../engagement/service.js');
  sendOk(res, await addReview(req.user.id, req.params.id, req.body), { status: 201 });
});

const payments = Router();
payments.use(requireAuth);
payments.post('/razorpay/verify', async (req, res) => {
  const { verifyCheckout } = await import('../payments/service.js');
  sendOk(res, await verifyCheckout(req.user.id, req.body));
});

const returns = Router();
returns.use(requireAuth);
returns.post('/', async (req, res) => {
  const { requestReturn } = await import('../engagement/service.js');
  sendOk(res, await requestReturn(req.user.id, req.body), { status: 201 });
});

const wishlist = Router();
wishlist.use(requireAuth);
wishlist.get('/', async (req, res) => {
  const { listWishlist } = await import('../engagement/service.js');
  sendOk(res, await listWishlist(req.user.id));
});
wishlist.post('/', async (req, res) => {
  const { addWish } = await import('../engagement/service.js');
  sendOk(res, await addWish(req.user.id, req.body.productId), { status: 201 });
});
wishlist.delete('/:productId', async (req, res) => {
  const { removeWish } = await import('../engagement/service.js');
  sendOk(res, await removeWish(req.user.id, req.params.productId));
});

const coupons = Router();
coupons.use(requireAuth);
coupons.post('/validate', async (req, res) => {
  const { quoteCoupon } = await import('../coupons/service.js');
  const priced = await quoteCoupon(req.user.id, req.body.code, Number(req.body.itemTotalPaise ?? 0));
  sendOk(res, { code: priced.coupon.code, discount: priced.discount });
});

const banners = Router();
banners.get('/', async (req, res) => {
  const { listBanners } = await import('../engagement/service.js');
  sendOk(res, await listBanners());
});

export function mountCommerce(app) {
  app.use('/api/v1/waitlist', waitlist);
  app.use('/api/v1/addresses', addresses);
  app.use('/api/v1/cart', cart);
  app.use('/api/v1/checkout', checkout);
  app.use('/api/v1/orders', orders);
  app.use('/api/v1/notifications', notifications);
  app.use('/api/v1/payments', payments);
  app.use('/api/v1/returns', returns);
  app.use('/api/v1/wishlist', wishlist);
  app.use('/api/v1/coupons', coupons);
  app.use('/api/v1/banners', banners);
}
