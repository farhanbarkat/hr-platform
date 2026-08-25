import mongoose from 'mongoose';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Resolves query filter based on tenant and department-level RBAC scoping.
 * @param {Object} req - Express Request
 * @param {Object} baseQuery - Existing MongoDB filter
 * @returns {Promise<Object>} - Scoped MongoDB filter
 */
export const buildScopedFilter = async (req, baseQuery = {}) => {
  const companyId = req.companyId || req.user?.companyId;
  if (!companyId) {
    throw new ApiError(403, 'Tenant context missing.');
  }

  const filter = {
    ...baseQuery,
    companyId: new mongoose.Types.ObjectId(companyId.toString()),
  };

  const userRole = req.user?.role;

  // 1. Full Company Visibility (ADMIN & HR)
  if (['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR'].includes(userRole)) {
    if (req.query?.departmentId && mongoose.Types.ObjectId.isValid(req.query.departmentId)) {
      filter.departmentId = new mongoose.Types.ObjectId(req.query.departmentId);
    }
    return filter;
  }

  // 2. Department-Scoped Visibility (MANAGER)
  if (userRole === 'MANAGER') {
    // Lookup Manager's own employee record to get their departmentId
    const managerEmployee = await Employee.findOne({
      $or: [
        { userId: req.user._id },
        { email: req.user.email },
      ],
      companyId: filter.companyId,
    }).select('departmentId');

    if (!managerEmployee || !managerEmployee.departmentId) {
      // If manager has no assigned department, return an impossible filter
      filter.departmentId = new mongoose.Types.ObjectId();
      return filter;
    }

    // Hard-lock to Manager's assigned department
    filter.departmentId = managerEmployee.departmentId;
    return filter;
  }

  // 3. Self-Scoped Visibility (EMPLOYEE)
  if (userRole === 'EMPLOYEE') {
    const selfEmployee = await Employee.findOne({
      $or: [
        { userId: req.user._id },
        { email: req.user.email },
      ],
      companyId: filter.companyId,
    }).select('_id');

    if (selfEmployee) {
      filter.employeeId = selfEmployee._id;
    } else {
      filter.userId = req.user._id;
    }
    return filter;
  }

  return filter;
};

/**
 * Scopes models that store employeeId by fetching matching department employee IDs.
 */
export const buildEmployeeScopedFilter = async (req, baseQuery = {}) => {
  const companyId = req.companyId || req.user?.companyId;
  const userRole = req.user?.role;

  const filter = {
    ...baseQuery,
    companyId: new mongoose.Types.ObjectId(companyId.toString()),
  };

  if (['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR'].includes(userRole)) {
    if (req.query?.departmentId && mongoose.Types.ObjectId.isValid(req.query.departmentId)) {
      const deptEmployees = await Employee.find({
        companyId: filter.companyId,
        departmentId: new mongoose.Types.ObjectId(req.query.departmentId),
      }).select('_id');
      
      filter.employeeId = { $in: deptEmployees.map(e => e._id) };
    }
    return filter;
  }

  if (userRole === 'MANAGER') {
    const managerEmployee = await Employee.findOne({
      $or: [{ userId: req.user._id }, { email: req.user.email }],
      companyId: filter.companyId,
    }).select('departmentId');

    if (!managerEmployee || !managerEmployee.departmentId) {
      filter.employeeId = new mongoose.Types.ObjectId();
      return filter;
    }

    const deptEmployees = await Employee.find({
      companyId: filter.companyId,
      departmentId: managerEmployee.departmentId,
    }).select('_id');

    filter.employeeId = { $in: deptEmployees.map(e => e._id) };
    return filter;
  }

  return filter;
};
