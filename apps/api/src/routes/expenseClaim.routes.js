import { Router } from 'express';
import {
  submitExpenseClaim,
  getMyExpenseClaims,
  getExpenseApprovalQueue,
  reviewExpenseClaim,
} from '../controllers/expenseClaim.controller.js';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// ESS Routes (Accessible by any authenticated employee)
router.post('/', submitExpenseClaim);
router.get('/my-claims', getMyExpenseClaims);

// HR / Manager Approval Queue Routes
router.get(
  '/queue',
  authorizeRoles('HR', 'ADMIN', 'COMPANY_ADMIN', 'MANAGER'),
  getExpenseApprovalQueue
);

router.patch(
  '/:id/action',
  authorizeRoles('HR', 'ADMIN', 'COMPANY_ADMIN', 'MANAGER'),
  reviewExpenseClaim
);

export default router;