import { Router } from 'express';
import {
  requestTaxCertificate,
  getTaxCertificates,
  downloadTaxCertificate,
} from '../controllers/taxCertificate.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.post('/generate', requirePermission(PERMISSIONS.PAYROLL.VIEW_OWN_PAYSLIP), requestTaxCertificate);
router.get('/', requirePermission(PERMISSIONS.PAYROLL.VIEW_OWN_PAYSLIP), getTaxCertificates);
router.get('/:id/download', requirePermission(PERMISSIONS.PAYROLL.VIEW_OWN_PAYSLIP), downloadTaxCertificate);

export default router;