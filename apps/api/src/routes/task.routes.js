import { Router } from 'express';
import { getTasks, createTask, updateTaskStatus } from '../controllers/task.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.get('/', requirePermission(PERMISSIONS.TASK.READ), getTasks);
router.post('/', requirePermission(PERMISSIONS.TASK.CREATE), createTask);
router.patch('/:id/status', requirePermission(PERMISSIONS.TASK.UPDATE), updateTaskStatus);

export default router;