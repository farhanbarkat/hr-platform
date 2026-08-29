import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Loan } from '../models/loan.model.js';
import { Employee } from '../models/employee.model.js';

/**
 * 1. Apply for Loan (Employee Self-Service)
 */
export const applyLoan = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { principal, tenureMonths, purpose } = req.body;

  const parsedPrincipal = parseFloat(principal);
  const parsedTenure = parseInt(tenureMonths, 10);

  if (!parsedPrincipal || parsedPrincipal <= 0) {
    throw new ApiError(400, 'A valid loan principal amount is required.');
  }

  if (!parsedTenure || parsedTenure <= 0) {
    throw new ApiError(400, 'Tenure in months must be a positive integer.');
  }

  // Resolve current Employee
  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found for the authenticated user.');
  }

  // Guard: Check if employee already has an active or pending loan
  const existingActiveLoan = await Loan.findOne({
    companyId,
    employeeId: employee._id,
    status: { $in: ['APPLIED', 'APPROVED'] },
  });

  if (existingActiveLoan) {
    throw new ApiError(
      400,
      `You already have a loan in '${existingActiveLoan.status}' status. Complete or resolve it before applying again.`
    );
  }

  // Calculate standard Monthly EMI
  const monthlyEmiVal = parseFloat((parsedPrincipal / parsedTenure).toFixed(2));

  const loan = await Loan.create({
    companyId,
    employeeId: employee._id,
    principal: mongoose.Types.Decimal128.fromString(parsedPrincipal.toFixed(2)),
    monthlyEmi: mongoose.Types.Decimal128.fromString(monthlyEmiVal.toFixed(2)),
    remainingBalance: mongoose.Types.Decimal128.fromString(parsedPrincipal.toFixed(2)),
    tenureMonths: parsedTenure,
    purpose: purpose || '',
    status: 'APPLIED',
  });

  const populatedLoan = await Loan.findById(loan._id).populate(
    'employeeId',
    'firstName lastName employeeId designation email'
  );

  return res.status(201).json(
    new ApiResponse(201, populatedLoan, 'Loan application submitted successfully.')
  );
});

/**
 * 2. Get Employee Loans (ESS - Self View)
 */
export const getMyLoans = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: req.user._id }, { _id: req.user.employeeId || req.user._id }],
  });

  if (!employee) {
    return res.status(200).json(new ApiResponse(200, [], 'No employee profile found.'));
  }

  const loans = await Loan.find({ companyId, employeeId: employee._id })
    .populate('approvedBy', 'email role')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, loans, 'Employee loans retrieved successfully.')
  );
});

/**
 * 3. Review Loan Approval Flags (Pre-approval Check for HR/Admin)
 */
export const checkLoanPreApproval = asyncHandler(async (req, res) => {
  const { loanId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    throw new ApiError(400, 'Invalid loan ID.');
  }

  // Find loan and ensure it belongs to the authenticated user's company
  const loan = await Loan.findOne({
    _id: new mongoose.Types.ObjectId(loanId),
    companyId: new mongoose.Types.ObjectId(req.companyId),
  }).populate(
    'employeeId',
    'firstName lastName employeeId contractEndDate joiningDate designation email'
  );

  if (!loan) {
    throw new ApiError(404, 'Loan application not found for this tenant.');
  }

  const flags = [];
  const currentDate = new Date();
  const estimatedPayoff = new Date(currentDate);
  estimatedPayoff.setMonth(estimatedPayoff.getMonth() + loan.tenureMonths);

  const contractEndDate = loan.employeeId?.contractEndDate
    ? new Date(loan.employeeId.contractEndDate)
    : null;

  if (contractEndDate && estimatedPayoff > contractEndDate) {
    flags.push({
      code: 'CONTRACT_EXPIRY_OVERRUN',
      severity: 'WARNING',
      message: `Proposed repayment schedule (${loan.tenureMonths} months, payoff by ${estimatedPayoff.toISOString().split('T')[0]}) extends past the employee's contract end date (${contractEndDate.toISOString().split('T')[0]}).`,
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        loan,
        estimatedPayoffDate: estimatedPayoff,
        contractEndDate,
        flags,
      },
      'Pre-approval evaluation generated.'
    )
  );
});

/**
 * 4. Approve or Reject Loan (HR / Company Admin Only)
 */
export const processLoanApproval = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { decision, rejectionReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new ApiError(400, "Decision must be either 'APPROVED' or 'REJECTED'.");
  }

  const loan = await Loan.findOne({
    _id: new mongoose.Types.ObjectId(loanId),
    companyId: new mongoose.Types.ObjectId(req.companyId),
  }).populate(
    'employeeId',
    'firstName lastName employeeId contractEndDate designation'
  );

  if (!loan) {
    throw new ApiError(404, 'Loan application not found for this tenant.');
  }

  if (loan.status !== 'APPLIED') {
    throw new ApiError(400, `Cannot process loan with status '${loan.status}'.`);
  }

  if (decision === 'REJECTED') {
    loan.status = 'REJECTED';
    loan.rejectionReason = rejectionReason || 'Application rejected by management.';
    loan.approvedBy = req.user._id;
    loan.approvedAt = new Date();
    await loan.save();

    return res.status(200).json(
      new ApiResponse(200, loan, 'Loan application has been rejected.')
    );
  }

  const now = new Date();
  const payoffDate = new Date(now);
  payoffDate.setMonth(payoffDate.getMonth() + loan.tenureMonths);

  const contractEnd = loan.employeeId?.contractEndDate
    ? new Date(loan.employeeId.contractEndDate)
    : null;

  const flags = [];
  if (contractEnd && payoffDate > contractEnd) {
    flags.push({
      code: 'CONTRACT_EXPIRY_OVERRUN',
      severity: 'WARNING',
      message: `Repayment schedule extends past known contract end date (${contractEnd.toISOString().split('T')[0]}). Approver acknowledged flag.`,
    });
  }

  loan.status = 'APPROVED';
  loan.approvedBy = req.user._id;
  loan.approvedAt = now;
  loan.disbursementDate = now;
  loan.expectedPayoffDate = payoffDate;
  loan.approvalFlags = flags;

  await loan.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      loan,
      flags.length > 0
        ? 'Loan approved with contract overrun warning flag.'
        : 'Loan approved successfully.'
    )
  );
});

/**
 * 5. List All Loans (Admin/HR Directory)
 */
export const getAllCompanyLoans = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { status, employeeId } = req.query;

  const query = { companyId };
  if (status) query.status = status;
  if (employeeId) query.employeeId = employeeId;

  const loans = await Loan.find(query)
    .populate('employeeId', 'firstName lastName employeeId email department designation contractEndDate')
    .populate('approvedBy', 'email role')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, loans, 'Company loans retrieved successfully.')
  );
});