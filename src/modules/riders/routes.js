import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { sendOk } from '../../utils/apiResponse.js';
import { applyRider, currentTrip, riderAction, riderEarnings, setAvailability } from './service.js';

const router = Router();
router.use(requireAuth);

router.post('/apply', async (req, res) => {
  sendOk(res, await applyRider(req.user.id, req.body), { status: 201 });
});
router.patch('/availability', async (req, res) => {
  sendOk(res, await setAvailability(req.user.id, req.body.availability));
});
router.get('/current', async (req, res) => {
  sendOk(res, await currentTrip(req.user.id));
});
router.get('/earnings', async (req, res) => {
  sendOk(res, await riderEarnings(req.user.id));
});
router.post('/shipments/:id/:action', async (req, res) => {
  sendOk(res, await riderAction(req.user.id, req.params.id, req.params.action, req.body ?? {}));
});

export default router;
