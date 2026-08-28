import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  getLetterTemplates,
  getLetterTemplateByType,
  upsertLetterTemplate,
  resetLetterTemplateToDefault,
  previewLetter,
} from '../controllers/letterTemplate.controller.js';

const router = Router();

// Apply auth & tenant isolation guards
router.use(verifyJWT, tenantMiddleware);

// HR / Company Admin restricted routes (Case-insensitive check support)
router.use(authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'company_admin', 'hr_manager', 'super_admin'));

router.get('/', getLetterTemplates);
router.get('/:templateType', getLetterTemplateByType);
router.put('/:templateType', upsertLetterTemplate);
router.delete('/:templateType/reset', resetLetterTemplateToDefault);
router.post('/:templateType/preview', previewLetter);

export default router;