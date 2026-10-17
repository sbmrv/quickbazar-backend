import { Router } from 'express';
import { publicReadLimit } from '../../middlewares/rateLimit.js';
import { publicCategories } from './controller.js';

const router = Router();

router.get('/', publicReadLimit, publicCategories);

export default router;
