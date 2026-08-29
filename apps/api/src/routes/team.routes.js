import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import {
  createTeam,
  postTeamDiscussion,
  getTeamDashboard,
} from '../controllers/team.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// Team Creation
router.post(
  '/',
  authorizeRoles('COMPANY_ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER'),
  createTeam
);

// Team Dashboard & Discussions
router.get('/:teamId/dashboard', getTeamDashboard);
router.post('/:teamId/discussions', postTeamDiscussion);

export default router;