import { Router } from 'express';
import {
  upsertTaxSlab,
  getTaxSlabs,
  simulateTaxCalculation,
  getTaxPresets,
  applyTaxPreset,
} from '../controllers/taxSlab.controller.js';
import { verifyJWT, authorizePermission } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// 1. Preset Endpoints (Must be above /:country or generic routes)
router.get('/presets', authorizePermission(PERMISSIONS.PAYROLL.READ), getTaxPresets);
router.get('/presets/:country', authorizePermission(PERMISSIONS.PAYROLL.READ), getTaxPresets);
router.post('/apply-preset', authorizePermission(PERMISSIONS.PAYROLL.UPDATE), applyTaxPreset);

// 2. Main Slabs Endpoints
router.route('/')
  .get(authorizePermission(PERMISSIONS.PAYROLL.READ), getTaxSlabs)
  .post(authorizePermission(PERMISSIONS.PAYROLL.UPDATE), upsertTaxSlab);

// 3. Simulation
router.post('/simulate', authorizePermission(PERMISSIONS.PAYROLL.READ), simulateTaxCalculation);

export default router;