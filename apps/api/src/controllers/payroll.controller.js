import { PayrollRun } from '../models/payrollRun.model.js';
import { Payslip } from '../models/payslip.model.js';
import { calculatePayrollRunOrchestrator } from '../services/payrollOrchestration.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Initialize a new Payroll Run in DRAFT state
 */
export const createPayrollRun = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { year, month } = req.body;

  if (!year || !month) {
    throw new ApiError(400, 'Year and month (1-12) are required.');
  }

  const existingRun = await PayrollRun.findOne({
    companyId,
    'period.year': Number(year),
    'period.month': Number(month),
  });

  if (existingRun) {
    throw new ApiError(409, `Payroll run already exists for period ${month}/${year}.`);
  }

  const startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const endDate = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999));

  const run = await PayrollRun.create({
    companyId,
    period: {
      year: Number(year),
      month: Number(month),
      startDate,
      endDate,
    },
    status: 'DRAFT',
    createdBy: req.user._id || req.user.id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, run, `Payroll run initialized for ${month}/${year} in DRAFT state.`));
});

/**
 * 2. Calculate Payroll Run (Explicit separate action)
 */
export const calculatePayrollRun = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const result = await calculatePayrollRunOrchestrator(companyId, id);

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Payroll run calculated successfully. Ready for review.'));
});

/**
 * 3. Approve Payroll Run (Explicit separate action by HR/Admin)
 */
export const approvePayrollRun = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const run = await PayrollRun.findOne({ _id: id, companyId });
  if (!run) {
    throw new ApiError(404, 'Payroll run not found.');
  }

  if (run.status !== 'CALCULATED') {
    throw new ApiError(400, `Cannot approve a run in '${run.status}' state. Run must be in 'CALCULATED' state.`);
  }

  run.status = 'APPROVED';
  run.approvedBy = req.user._id || req.user.id;
  run.lockedAt = new Date();
  await run.save();

  await Payslip.updateMany(
    { payrollRunId: run._id, companyId },
    { $set: { status: 'APPROVED' } }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, run, 'Payroll run approved and locked successfully.'));
});

/**
 * 4. Get Payroll Runs List
 */
export const getPayrollRuns = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const runs = await PayrollRun.find({ companyId })
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ 'period.year': -1, 'period.month': -1 });

  return res.status(200).json(new ApiResponse(200, runs, 'Payroll runs retrieved successfully.'));
});

/**
 * 5. Get Payslips for a Run
 */
export const getPayrollRunPayslips = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const payslips = await Payslip.find({ payrollRunId: id, companyId })
    .populate({
      path: 'employeeId',
      select: 'firstName lastName employeeCode',
      populate: { path: 'userId', select: 'name email' },
    })
    .sort({ createdAt: 1 });

  return res.status(200).json(new ApiResponse(200, payslips, 'Payslips retrieved successfully.'));
});

/**
 * 6. ESS: Employee View Own Payslip
 */
export const getMyPayslips = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const userId = req.user._id || req.user.id;

  const payslips = await Payslip.find({
    companyId,
    status: { $in: ['APPROVED', 'PAID'] },
  })
    .populate({
      path: 'employeeId',
      match: { $or: [{ userId }, { _id: req.user.employeeId }] },
      select: 'firstName lastName employeeCode',
    })
    .sort({ 'period.year': -1, 'period.month': -1 });

  const myPayslips = payslips.filter((p) => p.employeeId !== null);

  return res.status(200).json(new ApiResponse(200, myPayslips, 'My payslips retrieved successfully.'));
});