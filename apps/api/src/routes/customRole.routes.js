import { Router } from 'express';
import {
  getPermissionsCatalog,
  createCustomRole,
  getCompanyCustomRoles,
  updateCustomRole,
  assignCustomRole,
  getCustomRoleAssignmentsAudit,
} from '../controllers/customRole.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Sirf Company Admin ya Super Admin custom roles manage kar sakta hai
router.use(requirePermission('company.manage_roles'));

router.get('/permissions-catalog', getPermissionsCatalog);
router.get('/audit-assignments', getCustomRoleAssignmentsAudit);
router.post('/assign', assignCustomRole);

router.route('/')
  .get(getCompanyCustomRoles)
  .post(createCustomRole);

router.route('/:id')
  .put(updateCustomRole);

export default router;