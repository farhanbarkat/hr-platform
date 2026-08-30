import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import * as rbacMiddleware from '../middlewares/rbac.middleware.js';
import {
  raiseTicket,
  getMyTickets,
  getTriageQueue,
  getTicketDetails,
  updateTicketTriage,
  addTicketComment,
} from '../controllers/helpdesk.controller.js';

// Resolve role middleware function dynamically across naming conventions
const requireRoleMiddleware =
  rbacMiddleware.requireRole ||
  rbacMiddleware.authorizeRole ||
  rbacMiddleware.authorize ||
  rbacMiddleware.checkRole ||
  ((roles) => (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Forbidden: Insufficient role permissions.',
        success: false,
      });
    }
    next();
  });

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// Employee ESS Routes
router.post('/raise', raiseTicket);
router.get('/my-tickets', getMyTickets);

// Shared / Collaborative Thread Routes
router.get('/:ticketId', getTicketDetails);
router.post('/:ticketId/comments', addTicketComment);

// HR / Admin Triage Routes
router.get(
  '/queue/triage',
  requireRoleMiddleware(['COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER']),
  getTriageQueue
);
router.patch(
  '/:ticketId/triage',
  requireRoleMiddleware(['COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER']),
  updateTicketTriage
);

export default router;