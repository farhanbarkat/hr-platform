import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import {
  createPromotion,
  listPromotions,
  listEmployeePromotions,
  approvePromotion,
  respondToPromotion,
} from '../controllers/promotion.controller.js';

const router = Router();
router.use(verifyJWT, tenantMiddleware);

router.get('/', requirePermission('employee.read'), listPromotions);
router.post('/', requirePermission('employee.update'), createPromotion);
router.get('/employee/:employeeId', requirePermission('employee.view_own'), listEmployeePromotions);
router.patch('/:id/approve', requirePermission('employee.update'), approvePromotion);
router.patch('/:id/respond', requirePermission('employee.view_own'), respondToPromotion);

export default router;
