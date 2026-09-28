import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getAttendanceRecords,
  flagMissingCheckouts,
} from '../controllers/attendance.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission, requireAnyPermission } from '../middlewares/rbac.middleware.js';
import { enforceReadOnlyImpersonation } from '../middlewares/readOnly.middleware.js';
import { requireEntitlement } from '../middlewares/entitlement.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Global verification pipeline
router.use(verifyJWT, tenantMiddleware);
router.use(enforceReadOnlyImpersonation);

// 1. Check-in & Check-out:
// Har authenticated employee/user ke liye open (Basic Self-Service Permission)
// Plus Subscription Matrix check: 'mod_attendance_gps'
router.post(
  '/check-in',
  requirePermission(PERMISSIONS.ATTENDANCE.CHECK_IN),
  // requireEntitlement('mod_attendance_gps'),
  checkIn
);

router.post(
  '/check-out',
  requirePermission(PERMISSIONS.ATTENDANCE.CHECK_OUT),
  requireEntitlement('mod_attendance_gps'),
  checkOut
);

// 2. Query Attendance Records:
// Kisi ko bhi view attendance ki permission de sakti hai company
router.get(
  '/',
  requireAnyPermission([
    PERMISSIONS.ATTENDANCE.READ,
    PERMISSIONS.ATTENDANCE.VIEW_TEAM,
    PERMISSIONS.ATTENDANCE.VIEW_OWN,
  ]),
  getAttendanceRecords
);

// 3. Administrative / Managerial Action:
// Company chahe toh yeh authority HR ko de, Branch Manager ko de, ya kisi specific Supervisor ko de!
router.post(
  '/flag-missing-checkouts',
  requirePermission(PERMISSIONS.ATTENDANCE.UPDATE),
  flagMissingCheckouts
);

export default router;