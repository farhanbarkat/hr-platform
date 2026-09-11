import { Router } from 'express';
import {
  getAllPlans,
  createPlan,
  updatePlan,
  assignPlanToCompany,
  getAllBillingRecords,
  createBillingRecord,
  updateBillingRecordStatus,
  getPlatformAnalytics,
  getAuditLogs,
  getSupportTickets,
  updateSupportTicket,
  getPlatformSettings,
  updatePlatformSetting,
} from '../controllers/superAdminAdvanced.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

// Strict guard: All routes in this file require SUPER_ADMIN
router.use(verifyJWT);
router.use(requireRole('SUPER_ADMIN'));

/**
 * @openapi
 * /super-admin/plans:
 *   get:
 *     tags:
 *       - Super Admin — Plans & Tiers
 *     summary: Retrieve subscription plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of subscription plans
 *   post:
 *     tags:
 *       - Super Admin — Plans & Tiers
 *     summary: Create a subscription plan
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
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Enterprise Tier"
 *               price:
 *                 type: number
 *                 example: 25000
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 example: "monthly"
 *     responses:
 *       201:
 *         description: Plan created
 */
router.route('/plans').get(getAllPlans).post(createPlan);

/**
 * @openapi
 * /super-admin/plans/{id}:
 *   put:
 *     tags:
 *       - Super Admin — Plans & Tiers
 *     summary: Update existing plan
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
 *         description: Plan updated
 */
router.route('/plans/:id').put(updatePlan);

/**
 * @openapi
 * /super-admin/companies/{companyId}/assign-plan:
 *   post:
 *     tags:
 *       - Super Admin — Plans & Tiers
 *     summary: Assign subscription plan to tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
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
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Plan assigned successfully
 */
router.route('/companies/:companyId/assign-plan').post(assignPlanToCompany);

/**
 * @openapi
 * /super-admin/billing:
 *   get:
 *     tags:
 *       - Super Admin — Billing
 *     summary: Get all billing invoices & records
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing records retrieved
 *   post:
 *     tags:
 *       - Super Admin — Billing
 *     summary: Generate manual billing record/invoice
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - amount
 *             properties:
 *               companyId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 example: 50000
 *     responses:
 *       201:
 *         description: Billing invoice generated
 */
router.route('/billing').get(getAllBillingRecords).post(createBillingRecord);

/**
 * @openapi
 * /super-admin/billing/{id}/status:
 *   patch:
 *     tags:
 *       - Super Admin — Billing
 *     summary: Update invoice status (PAID, OVERDUE, VOID)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, OVERDUE, CANCELLED]
 *     responses:
 *       200:
 *         description: Billing status updated
 */
router.route('/billing/:id/status').patch(updateBillingRecordStatus);

/**
 * @openapi
 * /super-admin/analytics:
 *   get:
 *     tags:
 *       - Super Admin — Telemetry
 *     summary: Get live platform telemetry metrics and trend series
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics aggregated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalActiveTenants:
 *                       type: integer
 *                       example: 48
 *                     totalHeadcount:
 *                       type: integer
 *                       example: 3842
 *                     grossRunRate:
 *                       type: string
 *                       example: "PKR 1,450,000"
 *                     platformHealth:
 *                       type: string
 *                       example: "99.98%"
 */
router.route('/analytics').get(getPlatformAnalytics);

/**
 * @openapi
 * /super-admin/audit-logs:
 *   get:
 *     tags:
 *       - Super Admin — Audit Logs
 *     summary: Retrieve system audit logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Audit records returned
 */
router.route('/audit-logs').get(getAuditLogs);

/**
 * @openapi
 * /super-admin/support-tickets:
 *   get:
 *     tags:
 *       - Super Admin — Support Desk
 *     summary: List platform customer support tickets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support tickets list
 */
router.route('/support-tickets').get(getSupportTickets);

/**
 * @openapi
 * /super-admin/support-tickets/{id}:
 *   patch:
 *     tags:
 *       - Super Admin — Support Desk
 *     summary: Update ticket status or resolution
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
 *         description: Support ticket updated
 */
router.route('/support-tickets/:id').patch(updateSupportTicket);

/**
 * @openapi
 * /super-admin/settings:
 *   get:
 *     tags:
 *       - Super Admin — System Settings
 *     summary: Get global system configuration
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings
 *   post:
 *     tags:
 *       - Super Admin — System Settings
 *     summary: Update platform configuration
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System setting saved
 */
router.route('/settings').get(getPlatformSettings).post(updatePlatformSetting);

export default router;