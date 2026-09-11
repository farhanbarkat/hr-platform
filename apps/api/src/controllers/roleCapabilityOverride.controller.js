import { RoleCapabilityOverride } from '../models/roleCapabilityOverride.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Set or Update Permission Overrides (Grant Extra Powers OR Restrict Powers)
 * PUT /api/v1/role-overrides/:employeeId
 */
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

  // Update jobTitle (e.g. Senior HR, HR Intern, Attendance Supervisor)
  if (jobTitle !== undefined) {
    employee.jobTitle = jobTitle;
    await employee.save();
  }

  // Upsert the override record
  const override = await RoleCapabilityOverride.findOneAndUpdate(
    { companyId, employeeId },
    {
      companyId,
      employeeId,
      grantedPermissions: [...new Set(grantedPermissions.map((p) => p.trim()))],
      removedPermissions: [...new Set(removedPermissions.map((p) => p.trim()))],
      reason: reason.trim(),
      updatedBy: req.user._id,
    },
    { returnDocument: 'after', upsert: true, runValidators: true }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { override, jobTitle: employee.jobTitle },
      'Employee capabilities and permissions updated successfully.'
    )
  );
});

/**
 * 2. Get All Active Overrides in Company
 * GET /api/v1/role-overrides
 */
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

/**
 * 3. Remove Override (Restore Defaults)
 * DELETE /api/v1/role-overrides/:employeeId
 */
export const removeEmployeeCapabilityOverride = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { employeeId } = req.params;

  const result = await RoleCapabilityOverride.findOneAndDelete({ companyId, employeeId });
  if (!result) {
    throw new ApiError(404, 'No active override found for this employee.');
  }

  return res.status(200).json(
    new ApiResponse(200, null, 'Role capability override removed. Employee base permissions restored.')
  );
});