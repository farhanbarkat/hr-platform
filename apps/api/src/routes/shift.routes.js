import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  createShiftTemplate,
  getShiftTemplates,
  updateShiftTemplate,
  assignShift,
  getShiftAssignments,
} from '../controllers/shift.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// Shift Templates Management (HR / Admin)
router.route('/templates')
  .post(authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), createShiftTemplate)
  .get(getShiftTemplates);

router.route('/templates/:id')
  .patch(authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), updateShiftTemplate);

// Shift Assignments (HR / Managers)
router.route('/assignments')
  .post(authorizeRoles('COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), assignShift)
  .get(getShiftAssignments);

export default router;