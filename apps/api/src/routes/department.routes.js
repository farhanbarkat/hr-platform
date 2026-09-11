import { Router } from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  reassignEmployeeDepartment,
} from '../controllers/department.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

// Pipeline: 1. Auth -> 2. Tenant Context
router.use(verifyJWT);
router.use(tenantMiddleware);

/**
 * @openapi
 * /departments:
 *   get:
 *     tags:
 *       - Departments Management
 *     summary: Retrieve company departments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of departments retrieved successfully
 */
router.get(
  '/',
  requirePermission('departments:read'),
  getDepartments
);

/**
 * @openapi
 * /departments:
 *   post:
 *     tags:
 *       - Departments Management
 *     summary: Create a new department
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: Engineering
 *               code:
 *                 type: string
 *                 example: ENG
 *               description:
 *                 type: string
 *               headOfDepartment:
 *                 type: string
 *               designations:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Department created successfully
 *       403:
 *         description: Forbidden - Lacks departments:create permission
 */
router.post(
  '/',
  requirePermission('departments:create'),
  createDepartment
);

/**
 * @openapi
 * /departments/{id}:
 *   put:
 *     tags:
 *       - Departments Management
 *     summary: Update department details
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
 *         description: Department updated successfully
 *       403:
 *         description: Forbidden - Lacks departments:update permission
 */
router.put(
  '/:id',
  requirePermission('departments:update'),
  updateDepartment
);

/**
 * @openapi
 * /departments/{id}/deactivate:
 *   patch:
 *     tags:
 *       - Departments Management
 *     summary: Deactivate or soft-delete a department
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
 *         description: Department deactivated successfully
 *       403:
 *         description: Forbidden - Lacks departments:delete permission
 */
router.patch(
  '/:id/deactivate',
  requirePermission('departments:delete'),
  deactivateDepartment
);

/**
 * @openapi
 * /departments/employees/{employeeId}/reassign:
 *   patch:
 *     tags:
 *       - Departments Management
 *     summary: Reassign an employee to a new department
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetDepartmentId
 *             properties:
 *               targetDepartmentId:
 *                 type: string
 *               newDesignation:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Employee reassigned successfully
 *       403:
 *         description: Forbidden - Lacks departments:reassign permission
 */
router.patch(
  '/employees/:employeeId/reassign',
  requirePermission('departments:reassign'),
  reassignEmployeeDepartment
);

export default router;