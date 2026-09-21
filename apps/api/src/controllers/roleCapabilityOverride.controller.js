import { RoleCapabilityOverride } from '../models/roleCapabilityOverride.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { rbacService } from '../services/rbac.service.js';

export const setEmployeeCapabilityOverride = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { employeeId } = req.params;
  const { 
    grantedPermissions = [], 
    removedPermissions = [], 
    reason = 'Administrative capability delegation', 
    jobTitle 
  } = req.body;

  if (!Array.isArray(grantedPermissions) || !Array.isArray(removedPermissions)) {
    throw new ApiError(400, 'grantedPermissions and removedPermissions must be arrays.');
  }

  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) {
    throw new ApiError(404, 'Employee record not found in this company.');
  }

  if (jobTitle !== undefined && jobTitle.trim()) {
    employee.jobTitle = jobTitle.trim();
    employee.designation = jobTitle.trim();
    await employee.save();
  }

  // Upsert the override record with both granted and removed permissions
  const override = await RoleCapabilityOverride.findOneAndUpdate(
    { companyId, employeeId },
    {
      companyId,
      employeeId,
      grantedPermissions: [...new Set(grantedPermissions.map((p) => p.trim()))],
      removedPermissions: [...new Set(removedPermissions.map((p) => p.trim()))],
      jobTitle: jobTitle || employee.jobTitle || '',
      reason: reason.trim(),
      updatedBy: req.user._id,
    },
    { returnDocument: 'after', upsert: true, runValidators: true }
  );

  // 🔄 Instant Cache Invalidation: Update hote hi user ki cache clear karein
  if (employee.userId) {
    rbacService.invalidateUserCache(companyId, employee.userId);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      override,
      'Employee capabilities and permissions updated successfully.'
    )
  );
});

export const getCompanyCapabilityOverrides = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  const overrides = await RoleCapabilityOverride.find({ companyId })
    .populate({
      path: 'employeeId',
      select: 'firstName lastName email designation jobTitle employeeCode departmentId role',
      populate: { path: 'departmentId', select: 'name' },
    })
    .populate('updatedBy', 'name email')
    .sort({ updatedAt: -1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, overrides, 'Company capability overrides retrieved successfully.')
  );
});

export const removeEmployeeCapabilityOverride = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { employeeId } = req.params;

  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) {
    throw new ApiError(404, 'Employee record not found in this company.');
  }

  const result = await RoleCapabilityOverride.findOneAndDelete({ companyId, employeeId });
  if (!result) {
    throw new ApiError(404, 'No active override found for this employee.');
  }

  // 🔄 Instant Cache Invalidation: Base permissions restore hote hi cache clear karein
  if (employee.userId) {
    rbacService.invalidateUserCache(companyId, employee.userId);
  }

  return res.status(200).json(
    new ApiResponse(200, null, 'Role capability override removed. Employee base permissions restored.')
  );
});