import { Router } from 'express';
import {
  setEmployeeCapabilityOverride,
  getCompanyCapabilityOverrides,
  removeEmployeeCapabilityOverride,
} from '../controllers/roleCapabilityOverride.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Only Company Admin or Super Admin can manage role restrictions
router.use(requirePermission('company.manage_roles'));

router.get('/', getCompanyCapabilityOverrides);
router.put('/:employeeId', setEmployeeCapabilityOverride);
router.delete('/:employeeId', removeEmployeeCapabilityOverride);

export default router;