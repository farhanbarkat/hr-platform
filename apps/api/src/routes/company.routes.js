import { Router } from 'express';
import { createCompany, getCurrentCompany } from '../controllers/company.controller.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';

const router = Router();

// Route to onboard new tenant
router.route('/').post(createCompany);

// Tenant-scoped route (Requires tenant middleware context)
router.route('/me').get(tenantMiddleware, getCurrentCompany);

export default router;