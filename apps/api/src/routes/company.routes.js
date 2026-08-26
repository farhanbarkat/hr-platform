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
  if (!['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
    throw new ApiError(403, 'Forbidden: Admin access required.');
  }
  next();
};

// Route to onboard new tenant
router.route('/').post(createCompany);

// Tenant-scoped route
router.route('/me').get(tenantMiddleware, getCurrentCompany);

// Admin-only configurable settings (TICKET-017 AC-1)
router
  .route('/settings')
  .put(verifyJWT, tenantMiddleware, requireAdmin, updateCompanySettings)
  .patch(verifyJWT, tenantMiddleware, requireAdmin, updateCompanySettings);

export default router;