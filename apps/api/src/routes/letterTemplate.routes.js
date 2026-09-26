import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
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
router.use(requirePermission('company.configure'));

router.get('/', getLetterTemplates);
router.get('/:templateType', getLetterTemplateByType);
router.put('/:templateType', upsertLetterTemplate);
router.delete('/:templateType/reset', resetLetterTemplateToDefault);
router.post('/:templateType/preview', previewLetter);

export default router;