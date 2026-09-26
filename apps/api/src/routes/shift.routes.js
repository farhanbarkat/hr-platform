import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
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
  .post(requirePermission('calendar.manage'), createShiftTemplate)
  .get(getShiftTemplates);

router.route('/templates/:id')
  .patch(requirePermission('calendar.manage'), updateShiftTemplate);

// Shift Assignments (HR / Managers)
router.route('/assignments')
  .post(requirePermission('calendar.manage'), assignShift)
  .get(getShiftAssignments);

export default router;