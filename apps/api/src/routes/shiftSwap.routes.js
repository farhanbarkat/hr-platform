import { Router } from 'express';
import {
  proposeShiftSwap,
  respondToPeerSwapRequest,
  reviewSwapRequestByManager,
  getShiftSwapRequests,
} from '../controllers/shiftSwap.controller.js';
import { verifyJWT, authorizePermission } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// 1. Propose & View Swaps (Koi bhi employee kar sakta hai)
router.route('/')
  .get(getShiftSwapRequests)
  .post(proposeShiftSwap);

// 2. Colleague Peer Response (Sirf target employee)
router.put('/:id/peer-response', respondToPeerSwapRequest);

// 3. Manager / Incharge / Custom Role Final Approval
// ✅ Works for ANY Base Role (HR, Manager, Admin) AND ANY Custom Role (HOD, Shift Incharge, Supervisor)
// Jo bhi role 'attendance.update' permission rakhta hoga, wo approve kar sakega!
router.put(
  '/:id/manager-approval',
  authorizePermission(PERMISSIONS.ATTENDANCE.UPDATE),
  reviewSwapRequestByManager
);

export default router;