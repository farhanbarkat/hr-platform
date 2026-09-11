import { Router } from 'express';
import {
  createCompany,
  getCurrentCompany,
  updateCompanySettings,
} from '../controllers/company.controller.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// Inline Admin Check Guard
const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!['COMPANY_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
    throw new ApiError(403, 'Forbidden: Admin access required.');
  }
  next();
};

// Route to onboard new tenant (Super Admin only or initial setup)
router.route('/').post(verifyJWT, requireAdmin, createCompany);

// FIX 1: verifyJWT must run BEFORE tenantMiddleware so req.user is hydrated
router.route('/me').get(verifyJWT, tenantMiddleware, getCurrentCompany);

// Admin-only configurable settings
router
  .route('/settings')
  .put(verifyJWT, tenantMiddleware, requireAdmin, updateCompanySettings)
  .patch(verifyJWT, tenantMiddleware, requireAdmin, updateCompanySettings);

export default router;