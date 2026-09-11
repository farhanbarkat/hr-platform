import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireEntitlement } from '../middlewares/entitlement.middleware.js';
import {
  applyLoan,
  getMyLoans,
  checkLoanPreApproval,
  processLoanApproval,
  getAllCompanyLoans,
  getLoanRepaymentHistory,
  runMonthlyPayroll,
} from '../controllers/loan.controller.js';

const router = Router();

// 1. Authentication & Tenant Identification Pipeline
router.use(verifyJWT);
router.use(tenantMiddleware);

// 2. Feature Entitlement Gate (Global for all Loan Operations)
// Matches matrix capability: 'mod_payroll_loans'
router.use(requireEntitlement('mod_payroll_loans'));

// ==========================================
// Employee Self-Service (TICKET-029)
// ==========================================
router.post('/apply', applyLoan);
router.get('/my-loans', getMyLoans);

// ==========================================
// Batch Payroll Run with Atomic EMI Deduction (TICKET-030)
// ==========================================
router.post(
  '/run-payroll',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'),
  runMonthlyPayroll
);

// ==========================================
// Independent Repayment History Audit Query (TICKET-030)
// ==========================================
router.get(
  '/:loanId/repayments',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'EMPLOYEE'),
  getLoanRepaymentHistory
);

// ==========================================
// Pre-approval Flag Check & Approvals (Admin/HR Only) (TICKET-029)
// ==========================================
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

// ==========================================
// Admin Listing
// ==========================================
router.get(
  '/',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'),
  getAllCompanyLoans
);

export default router;