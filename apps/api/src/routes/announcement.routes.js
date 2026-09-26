import { Router } from 'express';
import {
  createAnnouncement,
  getMyAnnouncements,
  deactivateAnnouncement,
} from '../controllers/announcement.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

// Feed for web & mobile dashboard
router.get('/feed', getMyAnnouncements);

// Management routes restricted to HR & Admin
router.post('/', requirePermission('announcement.create'), createAnnouncement);
router.patch('/:id/deactivate', requirePermission('announcement.update'), deactivateAnnouncement);

export default router;