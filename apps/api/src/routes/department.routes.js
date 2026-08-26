import { Router } from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  reassignEmployeeDepartment,
} from '../controllers/department.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

// Order: 1. Auth -> 2. Tenant -> 3. Route Handlers
router.use(verifyJWT);
router.use(tenantMiddleware);

router.get('/', getDepartments);
router.post('/', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), createDepartment);
router.put('/:id', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), updateDepartment);
router.patch('/:id/deactivate', requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), deactivateDepartment);

// Reassign route
router.patch(
  '/employees/:employeeId/reassign',
  requireRole(['COMPANY_ADMIN', 'HR', 'SUPER_ADMIN']),
  reassignEmployeeDepartment
);

export default router;