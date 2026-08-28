import { Router } from 'express';
import { getEssDashboard } from '../controllers/ess.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Aggregated ESS Dashboard (Single fast call for mobile & web ESS)
router.get('/dashboard', getEssDashboard);

export default router;