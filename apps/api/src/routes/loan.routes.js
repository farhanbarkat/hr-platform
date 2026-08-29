import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  applyLoan,
  getMyLoans,
  checkLoanPreApproval,
  processLoanApproval,
  getAllCompanyLoans,
} from '../controllers/loan.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// Employee Self-Service
router.post('/apply', applyLoan);
router.get('/my-loans', getMyLoans);

// Pre-approval Flag Check & Approvals (Admin/HR Only)
router.get(
  '/pre-approval-check/:loanId',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'),
  checkLoanPreApproval
);
router.patch(
  '/:loanId/approval',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'),
  processLoanApproval
);

// Admin Listing
router.get(
  '/',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'),
  getAllCompanyLoans
);

export default router;