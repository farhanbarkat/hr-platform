import { Router } from 'express';
import {
  createSalaryType,
  getSalaryTypes,
  recordVariablePayrollInput,
  previewSalaryCalculation,
} from '../controllers/salaryType.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Company Admin / HR define salary types
router.post(
  '/',
  requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'HR_MANAGER']),
  createSalaryType
);

router.get('/', getSalaryTypes);

// HR/Manager records monthly variables
router.post(
  '/variable-input',
  requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'HR_MANAGER', 'MANAGER']),
  recordVariablePayrollInput
);

// Preview audit breakdown
router.get('/preview', previewSalaryCalculation);

export default router;