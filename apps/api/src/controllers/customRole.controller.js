import { CustomRole } from '../models/customRole.model.js';
import { User } from '../models/user.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  isValidPermission,
} from '../config/permissions.js';

/**
 * 1. UI Matrix & Defaults Data
 * GET /api/v1/custom-roles/permissions-catalog
 */
export const getPermissionsCatalog = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        modules: PERMISSIONS,
        allPermissions: ALL_PERMISSIONS,
        defaultTemplates: DEFAULT_ROLE_PERMISSIONS,
      },
      'Permissions catalog and templates retrieved successfully.'
    )
  );
});

/**
 * 2. Create Custom Role (e.g. HOD)
 * POST /api/v1/custom-roles
 */
export const createCustomRole = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { name, description, basedOnSystemRole = 'EMPLOYEE', permissions } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Custom role name is required.');
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new ApiError(400, 'At least one valid permission must be selected.');
  }

  // Validate har permission string master list me exist karti ho
  const invalidPerms = permissions.filter((p) => !isValidPermission(p));
  if (invalidPerms.length > 0) {
    throw new ApiError(400, `Invalid permissions provided: ${invalidPerms.join(', ')}`);
  }

  const existingRole = await CustomRole.findOne({
    companyId,
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
  });

  if (existingRole) {
    throw new ApiError(409, `A custom role with name '${name.trim()}' already exists in your company.`);
  }

  const role = await CustomRole.create({
    companyId,
    name: name.trim(),
    description: description?.trim() || '',
    basedOnSystemRole,
    permissions: [...new Set(permissions.map((p) => p.trim()))],
    createdBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, role, `Custom role '${role.name}' created successfully.`)
  );
});

/**
 * 3. List All Custom Roles of this Company
 * GET /api/v1/custom-roles
 */
export const getCompanyCustomRoles = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  const roles = await CustomRole.find({ companyId })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, roles, 'Custom roles retrieved successfully.')
  );
});

/**
 * 4. Update Custom Role
 * PUT /api/v1/custom-roles/:id
 */
export const updateCustomRole = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;
  const { name, description, permissions, isActive } = req.body;

  const role = await CustomRole.findOne({ _id: id, companyId });
  if (!role) {
    throw new ApiError(404, 'Custom role not found.');
  }

  if (name && name.trim()) {
    const duplicate = await CustomRole.findOne({
      companyId,
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });
    if (duplicate) {
      throw new ApiError(409, `Another custom role with name '${name.trim()}' already exists.`);
    }
    role.name = name.trim();
  }

  if (description !== undefined) role.description = description.trim();
  if (isActive !== undefined) role.isActive = Boolean(isActive);

  if (Array.isArray(permissions)) {
    const invalidPerms = permissions.filter((p) => !isValidPermission(p));
    if (invalidPerms.length > 0) {
      throw new ApiError(400, `Invalid permissions: ${invalidPerms.join(', ')}`);
    }
    role.permissions = [...new Set(permissions.map((p) => p.trim()))];
  }

  await role.save();

  return res.status(200).json(
    new ApiResponse(200, role, 'Custom role updated successfully.')
  );
});

/**
 * 5. Assign or Unassign Custom Role to an Employee
 * POST /api/v1/custom-roles/assign
 */
export const assignCustomRole = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { employeeId, customRoleId } = req.body;

  if (!employeeId) {
    throw new ApiError(400, 'Employee ID is required.');
  }

  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) {
    throw new ApiError(404, 'Employee not found in your company.');
  }

  let customRoleName = null;
  if (customRoleId) {
    const customRole = await CustomRole.findOne({ _id: customRoleId, companyId });
    if (!customRole) {
      throw new ApiError(404, 'Custom role not found in your company.');
    }
    customRoleName = customRole.name;
  }

  employee.customRoleId = customRoleId || null;
  await employee.save();

  if (employee.userId) {
    await User.updateOne(
      { _id: employee.userId, companyId },
      { $set: { customRoleId: customRoleId || null } }
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { employeeId: employee._id, customRoleId: employee.customRoleId },
      customRoleId
        ? `Custom role '${customRoleName}' assigned successfully.`
        : 'Custom role removed. Employee restored to standard system role.'
    )
  );
});

/**
 * 6. Audit List: Who has which custom role
 * GET /api/v1/custom-roles/audit-assignments
 */
export const getCustomRoleAssignmentsAudit = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  const roleHolders = await Employee.find({
    companyId,
    customRoleId: { $ne: null },
  })
    .populate('customRoleId', 'name permissions basedOnSystemRole')
    .populate('departmentId', 'name')
    .select('firstName lastName email designation jobTitle customRoleId departmentId employeeCode')
    .sort({ firstName: 1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, roleHolders, 'Custom role assignments audit retrieved successfully.')
  );
});