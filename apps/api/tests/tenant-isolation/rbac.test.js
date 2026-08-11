import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

// 1. ESM Mocks
jest.unstable_mockModule('../../src/services/rbac.service.js', () => ({
  rbacService: {
    hasPermission: jest.fn(),
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
        process.env.JWT_ACCESS_SECRET || 'test-access-secret-key-for-testing-only'
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
const { requirePermission } = await import('../../src/middlewares/rbac.middleware.js');
const { rbacService } = await import('../../src/services/rbac.service.js');
const { RolePermission } = await import('../../src/models/rolePermission.model.js');
const { getDefaultPermissionsForRole } = await import('../../src/config/permissions.js');

const mockRbacService = rbacService;
const mockRolePermission = RolePermission;

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.headers['x-company-id']) {
      req.companyId = req.headers['x-company-id'];
    }
    next();
  });
  app.post(
    '/test',
    verifyJWT,
    requirePermission('leave.approve_manager', {
      resourceType: 'leave',
      getTargetEmployeeId: (req) => req.body.employeeId,
    }),
    (req, res) => {
      res.json({ success: true, companyId: req.companyId });
    }
  );
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
    process.env.JWT_ACCESS_SECRET || 'test-access-secret-key-for-testing-only',
    { expiresIn: '15m' }
  );
};

describe('RBAC Cross-Tenant Isolation Tests', () => {
  let companyA_HR_User, companyB_HR_User;
  let companyA_Token, companyB_Token;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRbacService.permissionCache.clear();

    mockRbacService.hasPermission.mockImplementation(async (user, permission) => {
      const perms = await mockRolePermission.getEffectivePermissions(user.companyId, user.role);
      return perms.includes(permission);
    });

    mockRbacService.checkSelfApproval.mockImplementation((actorEmpId, targetEmpId, permission) => {
      if (actorEmpId && targetEmpId && actorEmpId === targetEmpId) {
        return { allowed: false, reason: `Self-approval not allowed for ${permission}` };
      }
      return { allowed: true };
    });

    companyA_HR_User = {
      _id: 'hr-a-123',
      email: 'hr@companyA.com',
      companyId: 'company-A',
      role: 'HR',
      employeeId: 'emp-hr-a',
    };
    companyB_HR_User = {
      _id: 'hr-b-456',
      email: 'hr@companyB.com',
      companyId: 'company-B',
      role: 'HR',
      employeeId: 'emp-hr-b',
    };

    companyA_Token = generateAccessToken(companyA_HR_User);
    companyB_Token = generateAccessToken(companyB_HR_User);
  });

  it('should isolate permissions - Company A HR has custom permission, Company B HR does not', async () => {
    mockRolePermission.getEffectivePermissions
      .mockResolvedValueOnce(['leave.read', 'leave.approve_manager', 'leave.approve_hr', 'leave.approve_final'])
      .mockResolvedValueOnce(getDefaultPermissionsForRole('HR'));

    const app = createTestApp();

    const resA = await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyA_Token}`)
      .set('x-company-id', 'company-A')
      .send({ employeeId: 'emp-target' });

    expect(resA.status).toBe(200);

    const resB = await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyB_Token}`)
      .set('x-company-id', 'company-B')
      .send({ employeeId: 'emp-target' });

    expect(resB.status).toBe(403);
    expect(mockRolePermission.getEffectivePermissions).toHaveBeenCalledWith('company-A', 'HR');
    expect(mockRolePermission.getEffectivePermissions).toHaveBeenCalledWith('company-B', 'HR');
  });

  it('should isolate permissions - Employee in Company A cannot access Company B data', async () => {
    const companyA_Employee = {
      _id: 'emp-a-123',
      email: 'employee@companyA.com',
      companyId: 'company-A',
      role: 'EMPLOYEE',
      employeeId: 'emp-emp-a',
    };
    const companyA_EmployeeToken = generateAccessToken(companyA_Employee);

    mockRolePermission.getEffectivePermissions.mockResolvedValue(
      getDefaultPermissionsForRole('EMPLOYEE')
    );

    const app = createTestApp();

    const res = await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyA_EmployeeToken}`)
      .set('x-company-id', 'company-B')
      .send({ employeeId: 'emp-target' });

    expect(res.status).toBe(403);
  });

  it('should not leak permission data between companies in logs', async () => {
    mockRolePermission.getEffectivePermissions
      .mockResolvedValueOnce(['leave.read', 'leave.approve_manager'])
      .mockResolvedValueOnce(getDefaultPermissionsForRole('HR'));

    const app = createTestApp();

    await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyA_Token}`)
      .set('x-company-id', 'company-A')
      .send({ employeeId: 'emp-target' });

    expect(mockRbacService.logAccessAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-A',
        userId: 'hr-a-123',
      })
    );

    jest.clearAllMocks();

    await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyB_Token}`)
      .set('x-company-id', 'company-B')
      .send({ employeeId: 'emp-target' });

    expect(mockRbacService.logAccessAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-B',
        userId: 'hr-b-456',
      })
    );
  });

  it('should enforce self-approval check per company independently', async () => {
    mockRolePermission.getEffectivePermissions.mockResolvedValue([
      'leave.read',
      'leave.approve_manager',
    ]);

    const app = createTestApp();

    const resA = await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyA_Token}`)
      .set('x-company-id', 'company-A')
      .send({ employeeId: 'emp-hr-a' });

    expect(resA.status).toBe(403);

    const resB = await request(app)
      .post('/test')
      .set('Authorization', `Bearer ${companyB_Token}`)
      .set('x-company-id', 'company-B')
      .send({ employeeId: 'emp-hr-b' });

    expect(resB.status).toBe(403);
  });
});