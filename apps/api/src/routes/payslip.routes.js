import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import {
  createAdjustment,
  generatePdf,
  getDownloadUrl,
  updatePayslip,
} from '../controllers/payslip.controller.js';

const router = Router();

router.use(verifyJWT);

// Post-approval adjustments
router.route('/adjustments').post(createAdjustment);

// PDF Generation and Secure Downloads
router.route('/:payslipId/generate-pdf').post(generatePdf);
router.route('/:payslipId/download').get(getDownloadUrl);

// Direct update endpoint for testing immutability
router.route('/:payslipId').put(updatePayslip).patch(updatePayslip);

export default router;