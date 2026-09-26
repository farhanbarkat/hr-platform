import { Router } from 'express';
import {
  createSalaryType,
  getSalaryTypes,
  recordVariablePayrollInput,
  previewSalaryCalculation,
} from '../controllers/salaryType.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Company Admin / HR define salary types
router.post(
  '/',
  requirePermission(PERMISSIONS.PAYROLL.UPDATE),
  createSalaryType
);

router.get('/', getSalaryTypes);

// HR/Manager records monthly variables
router.post(
  '/variable-input',
  requirePermission(PERMISSIONS.PAYROLL.UPDATE),
  recordVariablePayrollInput
);

// Preview audit breakdown
router.get('/preview', previewSalaryCalculation);

export default router;  