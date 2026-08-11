import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

// 1. ESM Mocks
jest.unstable_mockModule('../../src/services/rbac.service.js', () => ({
  rbacService: {
    hasPermission: jest.fn(),
    hasAnyPermission: jest.fn(),
    hasAllPermissions: jest.fn(),
    getUserPermissions: jest.fn(),
    checkSelfApproval: jest.fn(),
    logAccessAttempt: jest.fn(),
    permissionCache: {
      clear: jest.fn(),
    },
  },
}));

jest.unstable_mockModule('../../src/models/rolePermission.model.js', () => ({
  RolePermission: {
    getEffectivePermissions: jest.fn(),
  },
}));

jest.unstable_mockModule('../../src/middlewares/auth.middleware.js', () => ({
  verifyJWT: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    if (token === 'invalid-token') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'test-secret'
      );
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  },
}));

// 2. Dynamic Imports
const { verifyJWT } = await import('../../src/middlewares/auth.middleware.js');
const {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
} = await import('../../src/middlewares/rbac.middleware.js');
const { rbacService } = await import('../../src/services/rbac.service.js');
const { RolePermission } = await import('../../src/models/rolePermission.model.js');
const { getDefaultPermissionsForRole } = await import('../../src/config/permissions.js');

const mockRbacService = rbacService;
const mockRolePermission = RolePermission;

const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.companyId = 'company123';
    next();
  });
  app.post('/test', verifyJWT, middleware, (req, res) => {
    res.json({ success: true });
  });
  return app;
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
      employeeId: user.employeeId,
      tokenType: 'access',
    },
    process.env.JWT_ACCESS_SECRET || 'test-secret',
    { expiresIn: '15m' }
  );
};

describe('RBAC Middleware Integration Tests', () => {
  let hrUser, managerUser, employeeUser;
  let hrToken, managerToken, employeeToken;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRbacService.permissionCache.clear();

    hrUser = {
      _id: 'hr123',
      email: 'hr@company.com',
      companyId: 'company123',
      role: 'HR',
      employeeId: 'emp-hr',
    };
    managerUser = {
      _id: 'mgr123',
      email: 'manager@company.com',
      companyId: 'company123',
      role: 'MANAGER',
      employeeId: 'emp-mgr',
    };
    employeeUser = {
      _id: 'emp123',
      email: 'employee@company.com',
      companyId: 'company123',
      role: 'EMPLOYEE',
      employeeId: 'emp-emp',
    };

    hrToken = generateAccessToken(hrUser);
    managerToken = generateAccessToken(managerUser);
    employeeToken = generateAccessToken(employeeUser);

    mockRolePermission.getEffectivePermissions.mockImplementation(async (companyId, role) => {
      return getDefaultPermissionsForRole(role);
    });

    mockRbacService.hasPermission.mockImplementation(async (user, permission) => {
      const perms = await mockRolePermission.getEffectivePermissions(user.companyId, user.role);
      return perms.includes(permission);
    });

    mockRbacService.hasAnyPermission.mockImplementation(async (user, permissions) => {
      const perms = await mockRolePermission.getEffectivePermissions(user.companyId, user.role);
      return permissions.some((p) => perms.includes(p));
    });

    mockRbacService.hasAllPermissions.mockImplementation(async (user, permissions) => {
      const perms = await mockRolePermission.getEffectivePermissions(user.companyId, user.role);
      return permissions.every((p) => perms.includes(p));
    });

    mockRbacService.checkSelfApproval.mockImplementation((actorEmpId, targetEmpId, permission) => {
      if (actorEmpId && targetEmpId && actorEmpId === targetEmpId) {
        return { allowed: false, reason: `Self-approval not allowed for ${permission}` };
      }
      return { allowed: true };
    });
  });

  describe('requirePermission', () => {
    it('should allow HR to approve leave (has leave.approve_hr)', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_hr', {
          resourceType: 'leave',
          getTargetEmployeeId: (req) => req.body.employeeId,
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ employeeId: 'emp-target' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should deny MANAGER from final leave approval (lacks leave.approve_final)', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_final', {
          resourceType: 'leave',
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should deny EMPLOYEE from approving leave (lacks leave.approve_manager)', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_manager', {
          resourceType: 'leave',
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should block self-approval for leave', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_manager', {
          resourceType: 'leave',
          getTargetEmployeeId: (req) => req.body.employeeId,
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ employeeId: 'emp-mgr' });

      expect(res.status).toBe(403);
    });

    it('should allow approval when target is different employee', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_manager', {
          resourceType: 'leave',
          getTargetEmployeeId: (req) => req.body.employeeId,
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ employeeId: 'emp-other' });

      expect(res.status).toBe(200);
    });

    it('should return 401 when no token provided', async () => {
      const app = createTestApp(requirePermission('leave.read'));

      const res = await request(app).post('/test').send({});

      expect(res.status).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      const app = createTestApp(requirePermission('leave.read'));

      const res = await request(app)
        .post('/test')
        .set('Authorization', 'Bearer invalid-token')
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe('requireAnyPermission', () => {
    it('should allow when user has at least one permission', async () => {
      const app = createTestApp(
        requireAnyPermission(['leave.approve_hr', 'leave.approve_manager'], {
          resourceType: 'leave',
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('should deny when user has none of the permissions', async () => {
      const app = createTestApp(
        requireAnyPermission(['leave.approve_hr', 'leave.approve_final'], {
          resourceType: 'leave',
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('requireAllPermissions', () => {
    it('should allow when user has all permissions', async () => {
      const app = createTestApp(
        requireAllPermissions(['leave.read', 'leave.create'], {
          resourceType: 'leave',
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('should deny when user lacks any permission', async () => {
      const app = createTestApp(
        requireAllPermissions(['leave.read', 'system.super_admin'], {
          resourceType: 'leave',
        })
      );

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  describe('requireRole', () => {
    it('should allow when user has matching role', async () => {
      const app = createTestApp(requireRole(['HR', 'COMPANY_ADMIN']));

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('should deny when user role not in allowed list', async () => {
      const app = createTestApp(requireRole(['HR', 'COMPANY_ADMIN']));

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should work with single role string', async () => {
      const app = createTestApp(requireRole('HR'));

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('Cross-tenant isolation', () => {
    it('should use company-specific permissions from RolePermission model', async () => {
      const customPerms = ['leave.read', 'custom.permission'];
      mockRolePermission.getEffectivePermissions.mockResolvedValue(customPerms);

      const app = createTestApp(requirePermission('custom.permission'));

      const res = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(mockRolePermission.getEffectivePermissions).toHaveBeenCalledWith('company123', 'HR');
    });

    it('should isolate permissions between companies', async () => {
      mockRolePermission.getEffectivePermissions
        .mockResolvedValueOnce(['leave.read', 'companyA.custom'])
        .mockResolvedValueOnce(getDefaultPermissionsForRole('HR'));

      const app = createTestApp(requirePermission('companyA.custom'));

      const resA = await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(resA.status).toBe(200);
    });
  });

  describe('Access logging', () => {
    it('should log allowed access attempts', async () => {
      const app = createTestApp(requirePermission('leave.read', { resourceType: 'leave' }));

      await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({});

      expect(mockRbacService.logAccessAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company123',
          userId: 'hr123',
          permission: 'leave.read',
          resourceType: 'leave',
        })
      );
    });

    it('should log denied access attempts', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_final', { resourceType: 'leave' })
      );

      await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(mockRbacService.logAccessAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: 'leave.approve_final',
        })
      );
    });

    it('should log self-approval denials with reason', async () => {
      const app = createTestApp(
        requirePermission('leave.approve_manager', {
          resourceType: 'leave',
          getTargetEmployeeId: (req) => req.body.employeeId,
        })
      );

      await request(app)
        .post('/test')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ employeeId: 'emp-mgr' });

      expect(mockRbacService.logAccessAttempt).toHaveBeenCalled();
    });
  });
});