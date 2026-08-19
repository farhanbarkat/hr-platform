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

// --- Bulk import routes (Restricted to COMPANY_ADMIN and HR_MANAGER) ---
router.post(
  '/bulk-import',
  requireRole('COMPANY_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'),
  uploadCsv.single('file'),
  bulkImportEmployees
);

router.get(
  '/bulk-import/jobs/:jobId',
  requireRole('COMPANY_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'),
  getImportJobStatus
);

// --- HR & Company Admin Scoped Routes ---
router.route('/')
  .get(requireRole('COMPANY_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'), getEmployees)
  .post(requireRole('COMPANY_ADMIN', 'HR_MANAGER'), createEmployee);

// --- Dynamic Parameterized Routes (MUST BE AT THE END) ---
router.route('/:id')
  .get(requireRole('COMPANY_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN'), getEmployeeById)
  .put(requireRole('COMPANY_ADMIN', 'HR_MANAGER'), updateEmployee);

export default router;