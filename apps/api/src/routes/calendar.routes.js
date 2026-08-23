import { Router } from 'express';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../controllers/calendar.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(verifyJWT);
router.use(tenantMiddleware);

router.get('/', requirePermission(PERMISSIONS.CALENDAR.READ), getCalendarEvents);
router.post('/', requirePermission(PERMISSIONS.CALENDAR.READ), createCalendarEvent);
router.put('/:id', requirePermission(PERMISSIONS.CALENDAR.READ), updateCalendarEvent);
router.delete('/:id', requirePermission(PERMISSIONS.CALENDAR.READ), deleteCalendarEvent);

export default router;