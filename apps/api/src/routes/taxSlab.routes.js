import { Router } from 'express';
import {
  upsertTaxSlab,
  getTaxSlabs,
  simulateTaxCalculation,
} from '../controllers/taxSlab.controller.js';
import { verifyJWT, authorizePermission } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.route('/')
  .get(getTaxSlabs)
  .post(
    authorizePermission(PERMISSIONS.PAYROLL?.UPDATE || 'payroll.update'),
    upsertTaxSlab
  );

router.post('/simulate', simulateTaxCalculation);

export default router;