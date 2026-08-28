import { Router } from 'express';
import { getInchargeShiftDashboard } from '../controllers/shiftIncharge.controller.js';
import { verifyJWT, authorizePermission } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// ✅ Dynamic Check: Works for ANY Base Role AND ANY Custom Role (HOD, Shift Incharge, Supervisor, etc.)
// As long as that role has 'attendance.view_team' permission checked!
router.get(
  '/dashboard',
  authorizePermission(PERMISSIONS.ATTENDANCE.VIEW_TEAM),
  getInchargeShiftDashboard
);

export default router;