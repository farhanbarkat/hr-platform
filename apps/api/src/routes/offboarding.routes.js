import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
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

// Public / Tokenized Secure Access Route (For Exited Employees)
router.get('/secure-access/:token', getExitedEmployeeLetters);

// Protected routes with Tenant isolation
router.use(verifyJWT, tenantMiddleware);

// ESS Endpoint (Employee Resignation)
router.post('/initiate', initiateOffboarding);

// HR / Management Endpoints
router.get('/', authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), getCompanyOffboardings);
router.get('/:id/checklist', authorizeRoles('COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), getOffboardingChecklist);
router.patch('/checklist/:id', authorizeRoles('COMPANY_ADMIN', 'HR', 'MANAGER', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), updateChecklistItem);
router.patch('/:id/acknowledge', authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), acknowledgeResignation);
router.post('/:id/settle', authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), processFinalSettlement);
router.post('/:id/complete-exit', authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'), completeExit);

export default router;