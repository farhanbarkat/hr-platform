import { Router } from 'express';
import {
  createCompany,
  getCurrentCompany,
  updateCompanySettings,
} from '../controllers/company.controller.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// Route to onboard new tenant (Super Admin only or initial setup)
router.route('/').post(verifyJWT, requirePermission('company.create'), createCompany);

// FIX 1: verifyJWT must run BEFORE tenantMiddleware so req.user is hydrated
router.route('/me').get(verifyJWT, tenantMiddleware, requirePermission(PERMISSIONS.COMPANY.READ), getCurrentCompany);

// Admin-only configurable settings
router
  .route('/settings')
  .put(verifyJWT, tenantMiddleware, requirePermission(PERMISSIONS.COMPANY.UPDATE), updateCompanySettings)
  .patch(verifyJWT, tenantMiddleware, requirePermission(PERMISSIONS.COMPANY.UPDATE), updateCompanySettings);

export default router;