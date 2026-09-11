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
import { requirePermission, requireRole } from '../middlewares/rbac.middleware.js';
import { requireEntitlement } from '../middlewares/entitlement.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Global auth & tenant context pipeline
router.use(verifyJWT);
router.use(tenantMiddleware);

// Helper Guard: Company Admin & Super Admin bypass permission bottlenecks
const allowAdminOrPermission = (permissionKey) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (['COMPANY_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return next();
    }
    return requirePermission(permissionKey)(req, res, next);
  };
};

// Helper Guard: Admin bypass for Entitlement lock on administrative views
const allowAdminOrEntitlement = (entitlementKey) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (['COMPANY_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
      return next();
    }
    return requireEntitlement(entitlementKey)(req, res, next);
  };
};

// ==========================================
// 1. Employee ESS Endpoints (Baseline Access)
// ==========================================
router.get('/my-balances', allowAdminOrPermission(PERMISSIONS.LEAVE.VIEW_OWN), getMyLeaveBalances);
router.get('/my-requests', allowAdminOrPermission(PERMISSIONS.LEAVE.VIEW_OWN), getMyLeaveRequests);
router.post('/apply', allowAdminOrPermission(PERMISSIONS.LEAVE.CREATE), applyLeave);

// ==========================================
// 2. Leave Types & Setup (Admin / HR)
// ==========================================
router.get('/types', allowAdminOrPermission(PERMISSIONS.LEAVE.READ), getLeaveTypes);
router.post('/types', allowAdminOrPermission(PERMISSIONS.LEAVE.MANAGE_BALANCES), createLeaveType);
router.post(
  '/initialize-balances',
  allowAdminOrPermission(PERMISSIONS.LEAVE.MANAGE_BALANCES),
  initializeYearlyBalances
);
router.get(
  '/employee/:employeeId/balances',
  allowAdminOrPermission(PERMISSIONS.LEAVE.READ),
  getEmployeeBalancesByAdmin
);

// ==========================================
// 3. Multi-Stage Leave Approvals
// ==========================================
// FIX: Admins can view approval queue even if tenant plan is missing 'mod_leave_complex'
router.get(
  '/pending-approvals',
  (req, res, next) => {
    const role = req.user?.role;
    const userPermissions = req.user?.permissions || [];
    
    // Allow Company/Super Admin or users holding team view permissions
    if (
      ['COMPANY_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'HR', 'HR_MANAGER'].includes(role) ||
      userPermissions.includes(PERMISSIONS.LEAVE.VIEW_TEAM) ||
      userPermissions.includes(PERMISSIONS.LEAVE.READ)
    ) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions.' });
  },
  getPendingApprovals
);

// Stage 1: Manager Approval
router.patch(
  '/requests/:id/manager-approve',
  allowAdminOrPermission(PERMISSIONS.LEAVE.APPROVE_MANAGER),
  allowAdminOrEntitlement('mod_leave_complex'),
  managerApproveRequest
);

// Stage 2: HR Final Approval (Atomic decrement / Unpaid override)
router.patch(
  '/requests/:id/hr-approve',
  allowAdminOrPermission(PERMISSIONS.LEAVE.APPROVE_HR),
  allowAdminOrEntitlement('mod_leave_complex'),
  hrApproveRequest
);

// Rejection (Manager or HR)
router.patch(
  '/requests/:id/reject',
  allowAdminOrPermission(PERMISSIONS.LEAVE.APPROVE_MANAGER),
  allowAdminOrEntitlement('mod_leave_complex'),
  rejectRequest
);

// ==========================================
// 4. Leave History & Advanced Workflow Analytics
// ==========================================

// ESS Full Leave History (Self-Service)
router.get(
  '/my-history',
  getMyLeaveHistory
);

// PRD Turnaround Analytics (Company Admin / HR with Matrix Gate)
router.get(
  '/analytics/turnaround-time',
  requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'HR_MANAGER']),
  allowAdminOrEntitlement('mod_leave_complex'),
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
  allowAdminOrEntitlement('mod_leave_complex'),
  getLeaveRequestTimeline
);

export default router;