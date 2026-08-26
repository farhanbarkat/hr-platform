import { Router } from 'express';
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  getMyProfile,
  updateMyProfile,
} from '../controllers/employee.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { enforceReadOnlyImpersonation } from '../middlewares/readOnly.middleware.js';
import { uploadCsv } from '../middlewares/upload.middleware.js';
import {
  bulkImportEmployees,
  getImportJobStatus,
} from '../controllers/bulkImport.controller.js';

const router = Router();

// Base Middlewares
router.use(verifyJWT);
router.use(enforceReadOnlyImpersonation);

// --- Employee Self-Service Routes (Any authenticated employee) ---
router.get('/me/profile', getMyProfile);
router.patch('/me/profile', updateMyProfile);

// --- Bulk import routes (Restricted to COMPANY_ADMIN, HR, SUPER_ADMIN) ---
router.post(
  '/bulk-import',
  requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'),
  uploadCsv.single('file'),
  bulkImportEmployees
);

router.get(
  '/bulk-import/jobs/:jobId',
  requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'),
  getImportJobStatus
);

// --- Employees List & Create Routes (TICKET-005C: MANAGER added to GET) ---
router.route('/')
  .get(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'MANAGER', 'SUPER_ADMIN'), getEmployees)
  .post(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'), createEmployee);

// --- Dynamic Parameterized Routes (MUST BE AT THE END) ---
router.route('/:id')
  .get(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'MANAGER', 'SUPER_ADMIN'), getEmployeeById)
  .put(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'), updateEmployee);

export default router;