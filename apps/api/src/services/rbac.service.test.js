import { jest } from '@jest/globals';

// 1. Define Mocks BEFORE any imports
jest.unstable_mockModule('../models/rolePermission.model.js', () => ({
  RolePermission: {
    getEffectivePermissions: jest.fn(),
  },
}));

jest.unstable_mockModule('../models/accessLog.model.js', () => ({
  AccessLog: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

// 2. Dynamic Imports AFTER Mocks
const { rbacService } = await import('./rbac.service.js');
const { RolePermission } = await import('../models/rolePermission.model.js');
const { getDefaultPermissionsForRole } = await import('../config/permissions.js');

describe('RBACService', () => {
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.permissionCache.clear();

    mockUser = {
      _id: 'user123',
      companyId: 'company123',
      role: 'HR',
      employeeId: 'emp123',
    };
  });

  describe('getUserPermissions', () => {
    it('should return default permissions for role when no override exists', async () => {
      RolePermission.getEffectivePermissions.mockResolvedValue(
        getDefaultPermissionsForRole('HR')
      );

      const permissions = await rbacService.getUserPermissions(mockUser);

      expect(permissions).toEqual(getDefaultPermissionsForRole('HR'));
      expect(RolePermission.getEffectivePermissions).toHaveBeenCalledWith('company123', 'HR');
    });

    it('should return company-specific override when exists', async () => {
      const customPermissions = ['leave.read', 'leave.approve_manager'];
      RolePermission.getEffectivePermissions.mockResolvedValue(customPermissions);

      const permissions = await rbacService.getUserPermissions(mockUser);

      expect(permissions).toEqual(customPermissions);
    });

    it('should cache permissions and use cache on subsequent calls', async () => {
      const defaultPerms = getDefaultPermissionsForRole('HR');
      RolePermission.getEffectivePermissions.mockResolvedValue(defaultPerms);

      // First call
      await rbacService.getUserPermissions(mockUser);
      // Second call
      await rbacService.getUserPermissions(mockUser);

      // Should only call DB once due to caching
      expect(RolePermission.getEffectivePermissions).toHaveBeenCalledTimes(1);
    });

    it('should fall back to defaults on DB error', async () => {
      RolePermission.getEffectivePermissions.mockRejectedValue(new Error('DB down'));
      console.error = jest.fn();

      const permissions = await rbacService.getUserPermissions(mockUser);

      expect(permissions).toEqual(getDefaultPermissionsForRole('HR'));
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has the permission', async () => {
      const perms = ['leave.read', 'leave.approve_manager'];
      RolePermission.getEffectivePermissions.mockResolvedValue(perms);

      const result = await rbacService.hasPermission(mockUser, 'leave.read');

      expect(result).toBe(true);
    });

    it('should return false when user lacks the permission', async () => {
      const perms = ['leave.read'];
      RolePermission.getEffectivePermissions.mockResolvedValue(perms);

      const result = await rbacService.hasPermission(mockUser, 'leave.approve_manager');

      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all permissions', async () => {
      const perms = ['leave.read', 'leave.approve_manager', 'leave.create'];
      RolePermission.getEffectivePermissions.mockResolvedValue(perms);

      const result = await rbacService.hasAllPermissions(mockUser, ['leave.read', 'leave.create']);

      expect(result).toBe(true);
    });

    it('should return false when user lacks any permission', async () => {
      const perms = ['leave.read'];
      RolePermission.getEffectivePermissions.mockResolvedValue(perms);

      const result = await rbacService.hasAllPermissions(mockUser, ['leave.read', 'leave.approve_manager']);

      expect(result).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one permission', async () => {
      const perms = ['leave.read'];
      RolePermission.getEffectivePermissions.mockResolvedValue(perms);

      const result = await rbacService.hasAnyPermission(mockUser, ['leave.read', 'leave.approve_manager']);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the permissions', async () => {
      const perms = ['leave.read'];
      RolePermission.getEffectivePermissions.mockResolvedValue(perms);

      const result = await rbacService.hasAnyPermission(mockUser, ['leave.approve_manager', 'leave.approve_hr']);

      expect(result).toBe(false);
    });
  });

  describe('checkSelfApproval', () => {
    it('should allow when actor and target are different', () => {
      const result = rbacService.checkSelfApproval('emp123', 'emp456', 'leave.approve_manager');

      expect(result.allowed).toBe(true);
    });

    it('should deny when actor and target are the same', () => {
      const result = rbacService.checkSelfApproval('emp123', 'emp123', 'leave.approve_manager');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Self-approval not allowed for leave.approve_manager');
    });

    it('should allow when actorEmployeeId is missing', () => {
      const result = rbacService.checkSelfApproval(null, 'emp123', 'leave.approve_manager');

      expect(result.allowed).toBe(true);
    });

    it('should allow when targetEmployeeId is missing', () => {
      const result = rbacService.checkSelfApproval('emp123', null, 'leave.approve_manager');

      expect(result.allowed).toBe(true);
    });
  });

  describe('invalidateCache', () => {
    it('should remove cache entry for company+role', async () => {
      RolePermission.getEffectivePermissions.mockResolvedValue(getDefaultPermissionsForRole('HR'));
      await rbacService.getUserPermissions(mockUser);

      rbacService.invalidateCache('company123', 'HR');

      // Next call should hit DB again
      await rbacService.getUserPermissions(mockUser);
      expect(RolePermission.getEffectivePermissions).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateCompanyCache', () => {
    it('should remove all cache entries for a company', async () => {
      RolePermission.getEffectivePermissions.mockResolvedValue(getDefaultPermissionsForRole('HR'));
      await rbacService.getUserPermissions(mockUser);

      const managerUser = { ...mockUser, role: 'MANAGER' };
      await rbacService.getUserPermissions(managerUser);

      rbacService.invalidateCompanyCache('company123');

      await rbacService.getUserPermissions(mockUser);
      await rbacService.getUserPermissions(managerUser);

      expect(RolePermission.getEffectivePermissions).toHaveBeenCalledTimes(4); // 2 initial + 2 after invalidate
    });
  });
});