import { Router } from 'express';

// TICKET-012 Controllers
import {
  getLeaveTypes,
  createLeaveType,
  initializeYearlyBalances,
  getMyLeaveBalances,
  getEmployeeBalancesByAdmin,
} from '../controllers/leave.controller.js';

// TICKET-013 Controllers (Leave Workflow & Approvals)
import {
  applyLeave,
  getMyLeaveRequests,
  managerApproveRequest,
  hrApproveRequest,
  rejectRequest,
  getPendingApprovals,
  getMyLeaveHistory,
  getLeaveApprovalTurnaroundAnalytics,
  getLeaveRequestTimeline,
} from '../controllers/leaveRequest.controller.js';

import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission,
        requireRole
 } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Global auth & tenant context
router.use(verifyJWT);
router.use(tenantMiddleware);

// ==========================================
// 1. Employee ESS Endpoints (TICKET-012 & TICKET-013)
// ==========================================
router.get('/my-balances', requirePermission(PERMISSIONS.LEAVE.VIEW_OWN), getMyLeaveBalances);
router.get('/my-requests', requirePermission(PERMISSIONS.LEAVE.VIEW_OWN), getMyLeaveRequests);
router.post('/apply', requirePermission(PERMISSIONS.LEAVE.CREATE), applyLeave);

// ==========================================
// 2. Leave Types & Setup (Admin / HR)
// ==========================================
router.get('/types', requirePermission(PERMISSIONS.LEAVE.READ), getLeaveTypes);
router.post('/types', requirePermission(PERMISSIONS.LEAVE.MANAGE_BALANCES), createLeaveType);
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

// ==========================================
// 3. Two-Step Approval Workflow (TICKET-013)
// ==========================================
router.get(
  '/pending-approvals',
  requirePermission(PERMISSIONS.LEAVE.VIEW_TEAM),
  getPendingApprovals
);

// Stage 1: Manager Approval
router.patch(
  '/requests/:id/manager-approve',
  requirePermission(PERMISSIONS.LEAVE.APPROVE_MANAGER),
  managerApproveRequest
);

// Stage 2: HR Final Approval (Atomic decrement / Unpaid override)
router.patch(
  '/requests/:id/hr-approve',
  requirePermission(PERMISSIONS.LEAVE.APPROVE_HR),
  hrApproveRequest
);

// Rejection (Manager or HR)
router.patch(
  '/requests/:id/reject',
  requirePermission(PERMISSIONS.LEAVE.APPROVE_MANAGER),
  rejectRequest
);

// ==========================================
// 4. Leave History & Analytics (TICKET-014)
// ==========================================

// ESS Full Leave History (Self-Service)
router.get(
  '/my-history',
  getMyLeaveHistory
);

// PRD Turnaround Analytics (Company Admin / HR)
router.get(
  '/analytics/turnaround-time',
  requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'HR_MANAGER']),
  getLeaveApprovalTurnaroundAnalytics
);

// Detail View History Timeline
router.get(
  '/requests/:id/timeline',
  requireRole([
    'COMPANY_ADMIN',
    'SUPER_ADMIN',
    'HR',
    'HR_MANAGER',
    'MANAGER',
    'EMPLOYEE'
  ]),
  getLeaveRequestTimeline
);

export default router;