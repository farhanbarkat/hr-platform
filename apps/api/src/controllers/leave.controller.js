import { LeaveType } from '../models/leaveType.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { Employee } from '../models/employee.model.js';
import {
  initializeCompanyLeaveBalances,
  seedDefaultLeaveTypes,
} from '../services/leaveBalance.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// -------------------------------------------------------------
// LEAVE TYPE MANAGEMENT (Admin / HR)
// -------------------------------------------------------------

export const getLeaveTypes = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  await seedDefaultLeaveTypes(companyId);

  const leaveTypes = await LeaveType.find({ companyId }).sort({ createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, leaveTypes, 'Leave types retrieved successfully.'));
});

export const createLeaveType = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { name, code, defaultAllotment, isPaid, carryForwardMax, description } = req.body;

  if (!name || !code || defaultAllotment === undefined) {
    throw new ApiError(400, 'Name, uppercase code, and default allotment are required.');
  }

  const existingType = await LeaveType.findOne({
    companyId,
    code: code.toUpperCase().trim(),
  });

  if (existingType) {
    throw new ApiError(409, `Leave type with code '${code.toUpperCase()}' already exists.`);
  }

  const leaveType = await LeaveType.create({
    companyId,
    name: name.trim(),
    code: code.toUpperCase().trim(),
    defaultAllotment: Number(defaultAllotment),
    isPaid: isPaid ?? true,
    carryForwardMax: carryForwardMax ? Number(carryForwardMax) : 0,
    description: description || '',
    isDefault: false,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, leaveType, 'Custom leave type created successfully.'));
});

// -------------------------------------------------------------
// LEAVE BALANCE INITIALIZATION & VIEW
// -------------------------------------------------------------

export const initializeYearlyBalances = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const targetYear = req.body.year ? Number(req.body.year) : new Date().getFullYear();

  const stats = await initializeCompanyLeaveBalances(companyId, targetYear);

  return res.status(200).json(
    new ApiResponse(
      200,
      stats,
      `Leave balances initialized for year ${targetYear} successfully.`
    )
  );
});

export const getMyLeaveBalances = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const currentYear = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const userId = req.user?._id || req.user?.id;

  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId }, { _id: req.user?.employeeId }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found for the current user.');
  }

  const balances = await LeaveBalance.find({
    companyId,
    employeeId: employee._id,
    year: currentYear,
  })
    .populate('leaveTypeId', 'name code isPaid defaultAllotment')
    .sort({ createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, balances, 'Your leave balances retrieved successfully.'));
});

export const getEmployeeBalancesByAdmin = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { employeeId } = req.params;
  const targetYear = req.query.year ? Number(req.query.year) : new Date().getFullYear();

  const balances = await LeaveBalance.find({
    companyId,
    employeeId,
    year: targetYear,
  })
    .populate('leaveTypeId', 'name code isPaid defaultAllotment')
    .sort({ createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, balances, 'Employee leave balances retrieved successfully.'));
});