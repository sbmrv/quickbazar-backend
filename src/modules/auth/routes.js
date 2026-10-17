import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { authRateLimit } from '../../middlewares/rateLimit.js';
import { adminLoginSchema, enableRoleSchema, requestOtpSchema, verifyOtpSchema } from './validation.js';
import {
  adminLoginHandler,
  enableRoleHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  requestOtpHandler,
  verifyOtpHandler,
} from './controller.js';

const router = Router();

router.use(authRateLimit);
router.post('/otp/request', validate(requestOtpSchema), requestOtpHandler);
router.post('/otp/verify', validate(verifyOtpSchema), verifyOtpHandler);
router.post('/admin/login', validate(adminLoginSchema), adminLoginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);
router.get('/me', requireAuth, meHandler);
router.post('/roles/:role', requireAuth, validate(enableRoleSchema), enableRoleHandler);

export default router;
