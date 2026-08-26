import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { SalaryStructureService } from '../services/salaryStructure.service.js';

export const createSalaryStructure = asyncHandler(async (req, res) => {
  const { employeeId, effectiveFrom, basicPay, allowances, currency, notes } = req.body;

  const structure = await SalaryStructureService.createSalaryStructure({
    companyId: req.user.companyId,
    employeeId,
    effectiveFrom,
    basicPay,
    allowances,
    currency,
    notes,
    createdBy: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, structure, 'Salary structure revision created successfully.'));
});

export const getActiveSalary = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { date } = req.query;

  const targetDate = date ? new Date(date) : new Date();
  const structure = await SalaryStructureService.getActiveSalaryStructure(employeeId, targetDate);

  if (!structure) {
    throw new ApiError(404, 'No active salary structure found for this employee on the specified date.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, structure, 'Active salary structure retrieved successfully.'));
});

export const getSalaryHistory = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  const history = await SalaryStructureService.getSalaryHistory(req.user.companyId, employeeId);

  return res
    .status(200)
    .json(new ApiResponse(200, history, 'Salary history retrieved successfully.'));
});