import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
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
  .post(requireRole('COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'HR'), createAdjustment);

// PDF Generation and Secure Downloads
router
  .route('/:payslipId/generate-pdf')
  .post(requireRole('COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'HR'), generatePdf);
router.route('/:payslipId/download').get(getDownloadUrl);

// Direct update endpoint for testing immutability
router
  .route('/:payslipId')
  .put(requireRole('COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'HR'), updatePayslip)
  .patch(requireRole('COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'HR'), updatePayslip);

export default router;