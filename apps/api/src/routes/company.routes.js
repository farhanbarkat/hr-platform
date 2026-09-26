import { Router } from 'express';
import {
  createCompany,
  getCurrentCompany,
  updateCompanySettings,
} from '../controllers/company.controller.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission, requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

// Route to onboard new tenant (Super Admin only or initial setup)
router.route('/').post(verifyJWT, requirePermission('company.create'), createCompany);

// FIX 1: verifyJWT must run BEFORE tenantMiddleware so req.user is hydrated
router.route('/me').get(verifyJWT, tenantMiddleware, getCurrentCompany);

// Admin-only configurable settings
router
  .route('/settings')
  .put(verifyJWT, tenantMiddleware, requireRole('SUPER_ADMIN', 'COMPANY_ADMIN'), updateCompanySettings)
  .patch(verifyJWT, tenantMiddleware, requireRole('SUPER_ADMIN', 'COMPANY_ADMIN'), updateCompanySettings);

export default router;