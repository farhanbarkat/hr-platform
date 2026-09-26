import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../middlewares/tenant.middleware.js';
import { requirePermission } from '../middlewares/rbac.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  getTeams,
  createTeam,
  postTeamDiscussion,
  getTeamDashboard,
  updateTeamMembers,
} from '../controllers/team.controller.js';

const router = Router();

router.use(verifyJWT, tenantMiddleware);

// 1. List All Teams (HR, Company Admin, or Team Member)
router.get(
  '/',
  requirePermission(PERMISSIONS.EMPLOYEE?.READ || 'employee.read'),
  getTeams
);

// 2. Team Creation (Admin, HR, Manager)
router.post(
  '/',
  requirePermission(PERMISSIONS.TEAM.CREATE),
  createTeam
);

// 3. Team Dashboard (Internally checks team membership, managerId, or privileged role)
router.get('/:teamId/dashboard', getTeamDashboard);

router.patch('/:teamId/members', updateTeamMembers);

// 4. Team Discussions Feed
router.post('/:teamId/discussions', postTeamDiscussion);

export default router;