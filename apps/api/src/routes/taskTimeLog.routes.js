import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  startTimer,
  stopTimer,
  getActiveTimer,
  getTaskTimeSummary,
} from '../controllers/taskTimeLog.controller.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

router.post('/start', requirePermission(PERMISSIONS.TASK.UPDATE), startTimer);
router.post('/stop', requirePermission(PERMISSIONS.TASK.UPDATE), stopTimer);
router.get('/active', requirePermission(PERMISSIONS.TASK.READ), getActiveTimer);
router.get('/summary', requirePermission(PERMISSIONS.TASK.READ), getTaskTimeSummary);

export default router;