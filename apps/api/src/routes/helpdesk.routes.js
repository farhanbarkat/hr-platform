import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import {
  raiseTicket,
  getMyTickets,
  getTriageQueue,
  getTicketDetails,
  updateTicketTriage,
  addTicketComment,
} from '../controllers/helpdesk.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// Employee ESS Routes
router.post('/raise', raiseTicket);
router.get('/my-tickets', getMyTickets);

// HR / Admin Triage Routes must precede the dynamic ticket route.
router.get(
  '/queue/triage',
  requireRole(['COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER']),
  getTriageQueue
);
router.patch(
  '/:ticketId/triage',
  requireRole(['COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER']),
  updateTicketTriage
);

// Shared / Collaborative Thread Routes
router.get('/:ticketId', getTicketDetails);
router.post('/:ticketId/comments', addTicketComment);

export default router;