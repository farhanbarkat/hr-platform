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

// 1. Plans
router.route('/plans').get(getAllPlans).post(createPlan);
router.route('/plans/:id').put(updatePlan);
router.route('/companies/:companyId/assign-plan').post(assignPlanToCompany);

// 2. Billing
router.route('/billing').get(getAllBillingRecords).post(createBillingRecord);
router.route('/billing/:id/status').patch(updateBillingRecordStatus);

// 3. Analytics
router.route('/analytics').get(getPlatformAnalytics);

// 4. Audit Log Viewer
router.route('/audit-logs').get(getAuditLogs);

// 5. Platform Support
router.route('/support-tickets').get(getSupportTickets);
router.route('/support-tickets/:id').patch(updateSupportTicket);

// 6. System Settings
router.route('/settings').get(getPlatformSettings).post(updatePlatformSetting);

export default router;