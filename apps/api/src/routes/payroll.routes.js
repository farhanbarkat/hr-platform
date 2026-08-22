import { Router } from 'express';
import {
  createPayrollRun,
  calculatePayrollRun,
  approvePayrollRun,
  getPayrollRuns,
  getPayrollRunPayslips,
  getMyPayslips,
} from '../controllers/payroll.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// ESS View
router.get('/my-payslips', requirePermission(PERMISSIONS.PAYROLL.VIEW_OWN_PAYSLIP), getMyPayslips);

// Payroll Run Orchestration (HR / Admin)
router.get('/runs', requirePermission(PERMISSIONS.PAYROLL.READ), getPayrollRuns);
router.post('/runs', requirePermission(PERMISSIONS.PAYROLL.CREATE), createPayrollRun);
router.post('/runs/:id/calculate', requirePermission(PERMISSIONS.PAYROLL.RUN), calculatePayrollRun);
router.post('/runs/:id/approve', requirePermission(PERMISSIONS.PAYROLL.APPROVE), approvePayrollRun);
router.get('/runs/:id/payslips', requirePermission(PERMISSIONS.PAYROLL.VIEW_PAYSLIPS), getPayrollRunPayslips);

export default router;