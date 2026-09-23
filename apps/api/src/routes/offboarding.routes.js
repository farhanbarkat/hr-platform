import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  initiateOffboarding,
  acknowledgeResignation,
  updateChecklistItem,
  processFinalSettlement,
  completeExit,
  getExitedEmployeeLetters,
  getCompanyOffboardings,
  getOffboardingChecklist,
} from '../controllers/offboarding.controller.js';

const router = Router();

// Public / Tokenized Secure Access Route (For Exited Employees to download letters)
router.get('/secure-access/:token', getExitedEmployeeLetters);

// Protected routes with Tenant isolation & JWT verification
router.use(verifyJWT, tenantMiddleware);

// ESS Endpoint (Employee Resignation / Self-service)
router.post('/initiate', requirePermission(PERMISSIONS.LEAVE.CREATE), initiateOffboarding);

// HR / Management Endpoints (Using Granular RBAC Permissions)
router.get('/', requirePermission(PERMISSIONS.EMPLOYEE.READ), getCompanyOffboardings);
router.get('/:id/checklist', requirePermission(PERMISSIONS.EMPLOYEE.READ), getOffboardingChecklist);
router.patch('/checklist/:id', requirePermission(PERMISSIONS.EMPLOYEE.UPDATE), updateChecklistItem);
router.patch('/:id/acknowledge', requirePermission(PERMISSIONS.EMPLOYEE.UPDATE), acknowledgeResignation);
router.post('/:id/settle', requirePermission(PERMISSIONS.PAYROLL.CREATE), processFinalSettlement);
router.post('/:id/complete-exit', requirePermission(PERMISSIONS.EMPLOYEE.DELETE), completeExit);

export default router;