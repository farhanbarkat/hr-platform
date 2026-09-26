import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireEntitlement } from '../middlewares/entitlement.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
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
  requirePermission('payroll.run'),
  runMonthlyPayroll
);

// ==========================================
// Independent Repayment History Audit Query (TICKET-030)
// ==========================================
router.get(
  '/:loanId/repayments',
  requirePermission('finance.read_expense'),
  getLoanRepaymentHistory
);

// ==========================================
// Pre-approval Flag Check & Approvals (Admin/HR Only) (TICKET-029)
// ==========================================
router.get(
  '/pre-approval-check/:loanId',
  requirePermission('finance.approve_loan'),
  checkLoanPreApproval
);

router.patch(
  '/:loanId/approval',
  requirePermission('finance.approve_loan'),
  processLoanApproval
);

// ==========================================
// Admin Listing
// ==========================================
router.get(
  '/',
  requirePermission('finance.read_expense'),
  getAllCompanyLoans
);

export default router;