import { Router } from 'express';
import {
  getEligiblePeersAndMyShifts,
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

// 0. Eligible peers & logged-in employee shifts
router.get('/peers', getEligiblePeersAndMyShifts);

// 1. Propose & View Swaps
router.route('/')
  .get(getShiftSwapRequests)
  .post(proposeShiftSwap);

// 2. Colleague Peer Response
router.put('/:id/peer-response', respondToPeerSwapRequest);

// 3. Manager / Shift Incharge Final Approval
router.put(
  '/:id/manager-approval',
  authorizePermission(PERMISSIONS.ATTENDANCE.UPDATE),
  reviewSwapRequestByManager
);

export default router;