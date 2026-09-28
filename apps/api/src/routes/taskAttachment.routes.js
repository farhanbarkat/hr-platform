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
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.post('/presigned-upload', requirePermission(PERMISSIONS.TASK.UPDATE), getPresignedUploadUrl);
router.post('/', requirePermission(PERMISSIONS.TASK.UPDATE), createTaskAttachment);
router.get('/task/:taskId', requirePermission(PERMISSIONS.TASK.READ), getTaskAttachments);
router.get('/:id/download', requirePermission(PERMISSIONS.TASK.READ), getAttachmentDownloadUrl);
router.delete('/:id', requirePermission(PERMISSIONS.TASK.UPDATE), deleteTaskAttachment);

export default router;