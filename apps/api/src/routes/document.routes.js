import { Router } from 'express';
import {
  getUploadUrl,
  confirmUpload,
  getDownloadUrl,
  getEmployeeDocuments,
  getExpiringDocuments,
} from '../controllers/document.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import { enforceReadOnlyImpersonation } from '../middlewares/readOnly.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(enforceReadOnlyImpersonation);

// Pre-signed Upload URL (Admin/HR or self-employee)
router.post('/upload-url', getUploadUrl);

// Confirm Upload & Trigger Scan
router.post('/', confirmUpload);

// Pre-signed Download URL (Admin/HR or self-employee)
router.get('/:id/download-url', getDownloadUrl);

// List Employee Documents
router.get('/employee/:employeeId', getEmployeeDocuments);

// Admin-only: Query Expiring Documents for reminders
router.get('/expiring', requirePermission(PERMISSIONS.DOCUMENT.READ), getExpiringDocuments);

export default router;