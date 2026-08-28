import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  proposePromotion,
  approvePromotion,
  respondToPromotionOffer,
  getCompanyPromotions,
  getEmployeePromotionHistory,
  getMyPromotions,
} from '../controllers/promotion.controller.js';

const router = Router();

// Authentication & Tenant isolation
router.use(verifyJWT, tenantMiddleware);

// Employee Self-Service (ESS) Endpoints
router.get('/my', getMyPromotions);
router.patch('/:id/respond', respondToPromotionOffer);

// HR / Management Endpoints
router.get('/', authorizeRoles('COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN'), getCompanyPromotions);
router.get('/employee/:employeeId', authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'), getEmployeePromotionHistory);
router.post('/', authorizeRoles('COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN'), proposePromotion);
router.patch('/:id/approve', authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN'), approvePromotion);

export default router;