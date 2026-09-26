import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  createAdjustment,
  generatePdf,
  getDownloadUrl,
  updatePayslip,
} from '../controllers/payslip.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// Post-approval adjustments
router
  .route('/adjustments')
  .post(requirePermission(PERMISSIONS.PAYROLL.UPDATE), createAdjustment);

// PDF Generation and Secure Downloads
router
  .route('/:payslipId/generate-pdf')
  .post(requirePermission(PERMISSIONS.PAYROLL.RUN), generatePdf);
router.route('/:payslipId/download').get(getDownloadUrl);

// Direct update endpoint for testing immutability
router
  .route('/:payslipId')
  .put(requirePermission(PERMISSIONS.PAYROLL.UPDATE), updatePayslip)
  .patch(requirePermission(PERMISSIONS.PAYROLL.UPDATE), updatePayslip);

export default router;