import { Router } from 'express';
import {
  submitExpenseClaim,
  getMyExpenseClaims,
  getExpenseApprovalQueue,
  reviewExpenseClaim,
} from '../controllers/expenseClaim.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// ESS Routes (Accessible by any authenticated employee)
router.post('/', submitExpenseClaim);
router.get('/my-claims', getMyExpenseClaims);

// HR / Manager Approval Queue Routes
router.get(
  '/queue',
  requirePermission('finance.approve_expense'),
  getExpenseApprovalQueue
);

router.patch(
  '/:id/action',
  requirePermission('finance.approve_expense'),
  reviewExpenseClaim
);

export default router;