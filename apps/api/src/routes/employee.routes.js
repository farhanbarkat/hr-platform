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

/**
 * @openapi
 * /employees/me/profile:
 *   get:
 *     tags:
 *       - Employee Self Service
 *     summary: Get profile of logged-in employee
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me/profile', getMyProfile);

/**
 * @openapi
 * /employees/me/profile:
 *   patch:
 *     tags:
 *       - Employee Self Service
 *     summary: Update profile of logged-in employee
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 */
router.patch('/me/profile', updateMyProfile);

// --- Bulk import routes (Restricted to COMPANY_ADMIN, HR, SUPER_ADMIN) ---

/**
 * @openapi
 * /employees/bulk-import:
 *   post:
 *     tags:
 *       - Employee Administration
 *     summary: Bulk import employees via CSV file
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: Bulk import background job created
 *       403:
 *         description: Forbidden
 */
router.post(
  '/bulk-import',
  requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'),
  uploadCsv.single('file'),
  bulkImportEmployees
);

/**
 * @openapi
 * /employees/bulk-import/jobs/{jobId}:
 *   get:
 *     tags:
 *       - Employee Administration
 *     summary: Get bulk import job status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status details returned
 *       404:
 *         description: Job not found
 */
router.get(
  '/bulk-import/jobs/:jobId',
  requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'),
  getImportJobStatus
);

// --- Employees List & Create Routes (TICKET-005C: MANAGER added to GET) ---

/**
 * @openapi
 * /employees:
 *   get:
 *     tags:
 *       - Employee Administration
 *     summary: List organization employees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employees list returned successfully
 *       403:
 *         description: Forbidden
 *   post:
 *     tags:
 *       - Employee Administration
 *     summary: Create new employee
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - employeeCode
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               employeeCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Employee created successfully
 *       409:
 *         description: Duplicate email or employee code
 */
router.route('/')
  .get(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'MANAGER', 'SUPER_ADMIN'), getEmployees)
  .post(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'), createEmployee);

// --- Dynamic Parameterized Routes (MUST BE AT THE END) ---

/**
 * @openapi
 * /employees/{id}:
 *   get:
 *     tags:
 *       - Employee Administration
 *     summary: Get employee by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee details retrieved
 *       404:
 *         description: Employee not found
 *   put:
 *     tags:
 *       - Employee Administration
 *     summary: Update employee record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee record updated successfully
 *       404:
 *         description: Employee not found
 */
router.route('/:id')
  .get(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'MANAGER', 'SUPER_ADMIN'), getEmployeeById)
  .put(requireRole('COMPANY_ADMIN', 'HR', 'HR_MANAGER', 'SUPER_ADMIN'), updateEmployee);

export default router;