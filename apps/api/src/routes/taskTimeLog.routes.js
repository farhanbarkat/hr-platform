import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  startTimer,
  stopTimer,
  getActiveTimer,
  getTaskTimeSummary,
} from '../controllers/taskTimeLog.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

router.post('/start', startTimer);
router.post('/stop', stopTimer);
router.get('/active', getActiveTimer);
router.get('/summary', getTaskTimeSummary);

export default router;