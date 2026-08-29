import { Router } from 'express';
import {
  requestTaxCertificate,
  getTaxCertificates,
  downloadTaxCertificate,
} from '../controllers/taxCertificate.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.post('/generate', requestTaxCertificate);
router.get('/', getTaxCertificates);
router.get('/:id/download', downloadTaxCertificate);

export default router;