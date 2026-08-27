import { SalaryType } from '../models/salaryType.model.js';
import { VariablePayrollInput } from '../models/variablePayrollInput.model.js';
import { SalaryStructureService } from '../services/salaryStructure.service.js';
import { calculateEmployeeGrossSalary } from '../services/salaryCalculation.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// 1. Create Salary Type (Admin / HR)
export const createSalaryType = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { name, type, perUnitConfig, performanceConfig } = req.body;

  if (!name || !type) {
    throw new ApiError(400, 'Salary type name and type enum are required.');
  }

  const existing = await SalaryType.findOne({ companyId, name });
  if (existing) {
    throw new ApiError(409, 'A salary type with this name already exists.');
  }

  const salaryType = await SalaryType.create({
    companyId,
    name,
    type,
    perUnitConfig: type === 'PER_UNIT' ? perUnitConfig : undefined,
    performanceConfig:
      type === 'PERFORMANCE_BASED' ? performanceConfig : undefined,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, salaryType, 'Salary type created successfully.')
    );
});

// 2. Get All Salary Types for Company
export const getSalaryTypes = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const salaryTypes = await SalaryType.find({
    companyId,
    isActive: true,
  }).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(
      new ApiResponse(200, salaryTypes, 'Salary types retrieved successfully.')
    );
});

// 3. Record Monthly Variable Input (Units Worked or Metric Achieved)
export const recordVariablePayrollInput = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { employeeId, month, year, unitsWorked, metricValue, notes } =
    req.body;

  if (!employeeId || !month || !year) {
    throw new ApiError(400, 'Employee ID, month, and year are required.');
  }

  const record = await VariablePayrollInput.findOneAndUpdate(
    { companyId, employeeId, month, year },
    {
      companyId,
      employeeId,
      month,
      year,
      unitsWorked: unitsWorked || 0,
      metricValue: metricValue || 0,
      notes: notes || '',
      recordedBy: req.user._id,
    },
    { upsert: true, new: true, runValidators: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, record, 'Variable payroll input saved successfully.')
    );
});

// 4. Preview Dynamic Gross Salary Calculation (Audit Breakdown)
export const previewSalaryCalculation = asyncHandler(async (req, res) => {
  const { employeeId, month, year } = req.query;

  if (!employeeId || !month || !year) {
    throw new ApiError(400, 'employeeId, month, and year are required.');
  }

  // Set target date to the LAST day of the selected month so any revision during that month is included
  const targetDate = new Date(
    Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999)
  );

  // Fetch active structure snapshot
  const structure = await SalaryStructureService.getActiveSalaryStructure(
    employeeId,
    targetDate
  );

  if (!structure) {
    throw new ApiError(404, 'No salary structure found for this employee.');
  }

  // Fetch variable input if any
  const variableInput = await VariablePayrollInput.findOne({
    companyId: req.user.companyId,
    employeeId,
    month: Number(month),
    year: Number(year),
  }).lean();

  // Run calculation strategy engine
  const calculation = calculateEmployeeGrossSalary({
    structure,
    salaryType: structure.salaryTypeId,
    variableInput: variableInput || { unitsWorked: 0, metricValue: 0 },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employeeId,
        structure,
        salaryType: structure.salaryTypeId,
        variableInput,
        calculation,
      },
      'Salary preview calculated successfully.'
    )
  );
});