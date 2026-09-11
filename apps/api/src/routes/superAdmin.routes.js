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

/**
 * @openapi
 * /super-admin/companies:
 *   get:
 *     tags:
 *       - Super Admin — Companies
 *     summary: List all companies/tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tenant companies
 *   post:
 *     tags:
 *       - Super Admin — Companies
 *     summary: Create a new company/tenant
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
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Acme Corp"
 *               slug:
 *                 type: string
 *                 example: "acme-corp"
 *               currency:
 *                 type: string
 *                 example: "PKR"
 *               timezone:
 *                 type: string
 *                 example: "Asia/Karachi"
 *     responses:
 *       201:
 *         description: Company created successfully
 */
router.route('/companies')
  .post(createCompany)
  .get(listCompanies);

/**
 * @openapi
 * /super-admin/companies/{id}/status:
 *   patch:
 *     tags:
 *       - Super Admin — Companies
 *     summary: Toggle tenant active/suspended status
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
 *         description: Status updated successfully
 */
router.patch('/companies/:id/status', toggleCompanyStatus);

/**
 * @openapi
 * /super-admin/companies/{id}/impersonate:
 *   post:
 *     tags:
 *       - Super Admin — Companies
 *     summary: Impersonate tenant admin
 *     description: Issues temporary delegation token to debug or manage tenant enclave.
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
 *         description: Impersonation token issued
 */
router.post('/companies/:id/impersonate', impersonateCompany);

export default router;