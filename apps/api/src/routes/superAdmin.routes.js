import { Router } from 'express';
import {
  createCompany,
  listCompanies,
  toggleCompanyStatus,
  impersonateCompany,
} from '../controllers/superAdmin.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

// Enforce authentication & SUPER_ADMIN role across ALL routes in this module
router.use(verifyJWT, requireRole('SUPER_ADMIN'));

router.route('/companies')
  .post(createCompany)
  .get(listCompanies);

router.patch('/companies/:id/status', toggleCompanyStatus);
router.post('/companies/:id/impersonate', impersonateCompany);

export default router;