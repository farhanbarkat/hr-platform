import { Router } from 'express';
import { getTasks, createTask, updateTaskStatus } from '../controllers/task.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.get('/', requirePermission(PERMISSIONS.TASKS.READ), getTasks);
router.post('/', requirePermission(PERMISSIONS.TASKS.CREATE), createTask);
router.patch('/:id/status', requirePermission(PERMISSIONS.TASKS.UPDATE_STATUS), updateTaskStatus);

export default router;