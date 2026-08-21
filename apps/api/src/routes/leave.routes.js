import { Router } from 'express';
import {
  getLeaveTypes,
  createLeaveType,
  initializeYearlyBalances,
  getMyLeaveBalances,
  getEmployeeBalancesByAdmin,
} from '../controllers/leave.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js'; // path check kar lein

const router = Router();
router.use(verifyJWT);
router.use(tenantMiddleware);

// ESS View - Employee views own balances (leave.view_own)
router.get('/my-balances', requirePermission(PERMISSIONS.LEAVE.VIEW_OWN), getMyLeaveBalances);

// Leave Types (Read: leave.read | Manage/Create: leave.manage_balances ya leave.create)
router.get('/types', requirePermission(PERMISSIONS.LEAVE.READ), getLeaveTypes);
router.post('/types', requirePermission(PERMISSIONS.LEAVE.MANAGE_BALANCES), createLeaveType);

// Admin Operations (leave.manage_balances & leave.read)
router.post(
  '/initialize-balances',
  requirePermission(PERMISSIONS.LEAVE.MANAGE_BALANCES),
  initializeYearlyBalances
);
router.get(
  '/employee/:employeeId/balances',
  requirePermission(PERMISSIONS.LEAVE.READ),
  getEmployeeBalancesByAdmin
);

export default router;