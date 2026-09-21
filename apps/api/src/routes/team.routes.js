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
  (req, res, next) => {
    const allowedRoles = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR', 'MANAGER'];
    const userRole = typeof req.user.role === 'object' ? req.user.role.name : req.user.role;
    
    // Check role OR check permission
    const hasRole = allowedRoles.includes(userRole);
    const hasPerm = req.user.permissions?.includes('team.create') || req.user.permissions?.includes('company.configure');
    
    if (!hasRole && !hasPerm) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Forbidden: Only Company Admin, HR, or Managers can create teams.',
        success: false,
      });
    }
    next();
  },
  createTeam
);

// 3. Team Dashboard (Internally checks team membership, managerId, or privileged role)
router.get('/:teamId/dashboard', getTeamDashboard);

router.patch('/:teamId/members', updateTeamMembers);

// 4. Team Discussions Feed
router.post('/:teamId/discussions', postTeamDiscussion);

export default router;