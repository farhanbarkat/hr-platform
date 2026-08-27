import { Router } from 'express';
import {
  setEmployeeCapabilityOverride,
  getCompanyCapabilityOverrides,
  removeEmployeeCapabilityOverride,
} from '../controllers/roleCapabilityOverride.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Only Company Admin or Super Admin can manage role restrictions
router.use(authorizeRoles('ADMIN', 'COMPANY_ADMIN'));

router.get('/', getCompanyCapabilityOverrides);
router.put('/:employeeId', setEmployeeCapabilityOverride);
router.delete('/:employeeId', removeEmployeeCapabilityOverride);

export default router;