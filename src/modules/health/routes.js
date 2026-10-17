import { Router } from 'express';
import { health } from './controller.js';

const router = Router();

router.get('/', health);

export default router;
