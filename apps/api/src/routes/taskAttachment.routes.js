import { Router } from 'express';
import {
  getPresignedUploadUrl,
  createTaskAttachment,
  getTaskAttachments,
  getAttachmentDownloadUrl,
  deleteTaskAttachment,
} from '../controllers/taskAttachment.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.post('/presigned-upload', getPresignedUploadUrl);
router.post('/', createTaskAttachment);
router.get('/task/:taskId', getTaskAttachments);
router.get('/:id/download', getAttachmentDownloadUrl);
router.delete('/:id', deleteTaskAttachment);

export default router;