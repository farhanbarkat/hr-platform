import { Router } from 'express';
import {
  getFinanceDashboard,
  updateThresholdConfig,
  createOperationalExpense,
  createCompanyIncome,
} from '../controllers/finance.controller.js';
import { verifyJWT, authorizePermission } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// 1. Dashboard View (Uses 'finance.view_dashboard')
router.get(
  '/dashboard',
  authorizePermission(PERMISSIONS.FINANCE.VIEW_DASHBOARD),
  getFinanceDashboard
);

// 2. Alert Thresholds / Settings (Uses 'settings.update' or 'company.configure')
router.put(
  '/settings/thresholds',
  authorizePermission(PERMISSIONS.SETTINGS.UPDATE),
  updateThresholdConfig
);

// 3. Add Operational Expense (Uses 'finance.create_expense')
router.post(
  '/expenses',
  authorizePermission(PERMISSIONS.FINANCE.CREATE_EXPENSE),
  createOperationalExpense
);

// 4. Record Company Income (Uses 'finance.create_income')
router.post(
  '/income',
  authorizePermission(PERMISSIONS.FINANCE.CREATE_INCOME),
  createCompanyIncome
);

export default router;