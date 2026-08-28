import { Router } from 'express';
import {
  createAnnouncement,
  getMyAnnouncements,
  deactivateAnnouncement,
} from '../controllers/announcement.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

const elevatedRoles = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'HR_MANAGER'];

// Feed for web & mobile dashboard
router.get('/feed', getMyAnnouncements);

// Management routes restricted to HR & Admin
router.post('/', requireRole(elevatedRoles), createAnnouncement);
router.patch('/:id/deactivate', requireRole(elevatedRoles), deactivateAnnouncement);

export default router;