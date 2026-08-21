import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getAttendanceRecords,
  flagMissingCheckouts,
} from '../controllers/attendance.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { enforceReadOnlyImpersonation } from '../middlewares/readOnly.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(enforceReadOnlyImpersonation);

// Employee & HR check-in/out endpoints
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);

// Query records (Employee sees own, Admin/HR sees all)
router.get('/', getAttendanceRecords);

// Admin-only: Review and flag missing checkouts
router.post(
  '/flag-missing-checkouts',
  requireRole('COMPANY_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'),
  flagMissingCheckouts
);

export default router;