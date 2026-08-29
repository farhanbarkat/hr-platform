import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Loan } from '../models/loan.model.js';
import { LoanRepayment } from '../models/loanRepayment.model.js';
import { Employee } from '../models/employee.model.js';
import { Payslip } from '../models/payslip.model.js';

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

/**
 * 6. Get Loan Repayment History (Independent Audit Collection - TICKET-030)
 */
export const getLoanRepaymentHistory = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { loanId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    throw new ApiError(400, 'Invalid loan ID.');
  }

  const repayments = await LoanRepayment.find({
    loanId: new mongoose.Types.ObjectId(loanId),
    companyId: new mongoose.Types.ObjectId(companyId),
  })
    .populate('payslipId', 'period netPay status')
    .sort({ repaymentDate: -1 });

  return res.status(200).json(
    new ApiResponse(200, repayments, 'Loan repayment history retrieved successfully.')
  );
});

/**
 * 7. Execute Atomic Monthly Payroll Run with Auto Loan Deduction (TICKET-030)
 */
export const runMonthlyPayroll = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { month, year } = req.body;

  if (!month || !year) {
    throw new ApiError(400, 'Payroll month and year are required.');
  }

  // Safe Month string/number parser
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const parsedMonth = typeof month === 'string' && isNaN(month)
    ? monthNames.indexOf(month.toLowerCase()) + 1
    : Number(month);

  const parsedYear = Number(year);

  // MongoDB Transaction to guarantee atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let employees = await Employee.find({
      companyId,
      $or: [
        { isActive: true },
        { isActive: { $exists: false } },
        { status: 'ACTIVE' },
      ],
    }).session(session);

    if (!employees || employees.length === 0) {
      employees = await Employee.find({ companyId }).session(session);
    }

    if (!employees || employees.length === 0) {
      throw new Error('No employee records exist for this company.');
    }

    const generatedPayslips = [];
    const generatedPayrollRunId = new mongoose.Types.ObjectId();

    for (const emp of employees) {
      // 1. Check for Active Approved Loan within Transaction Session
      const activeLoan = await Loan.findOne({
        companyId,
        employeeId: emp._id,
        status: 'APPROVED',
        remainingBalance: { $gt: mongoose.Types.Decimal128.fromString('0') },
      }).session(session);

      let emiDeduction = 0;
      let repaymentAudit = null;

      if (activeLoan) {
        const currentBalance = parseFloat(activeLoan.remainingBalance.toString());
        const configuredEmi = parseFloat(activeLoan.monthlyEmi.toString());

        emiDeduction = Math.min(configuredEmi, currentBalance);
        const newBalance = parseFloat((currentBalance - emiDeduction).toFixed(2));

        // Decrement Loan Balance atomically
        activeLoan.remainingBalance = mongoose.Types.Decimal128.fromString(newBalance.toFixed(2));
        if (newBalance <= 0) {
          activeLoan.status = 'COMPLETED';
        }
        await activeLoan.save({ session });

        repaymentAudit = {
          loanId: activeLoan._id,
          amount: emiDeduction,
          principalBefore: currentBalance,
          principalAfter: newBalance,
        };
      }

      // 2. Compute Financial Breakdown
      const basic = parseFloat(emp.basicSalary?.toString() || 80000);
      const allowances = 10000;
      const grossPay = basic + allowances;
      const otherDeductions = 5000;
      const totalDeductions = otherDeductions + emiDeduction;
      const netPay = Math.max(0, grossPay - totalDeductions);

      // 3. Create Payslip inside Session matching exact Schema fields
      const payslip = new Payslip({
        companyId,
        employeeId: emp._id,
        payrollRunId: generatedPayrollRunId,
        period: {
          year: parsedYear,
          month: parsedMonth,
        },
        earnings: {
          basicSalary: mongoose.Types.Decimal128.fromString(basic.toFixed(2)),
          allowances: mongoose.Types.Decimal128.fromString(allowances.toFixed(2)),
          overtimePay: mongoose.Types.Decimal128.fromString('0.00'),
          grossPay: mongoose.Types.Decimal128.fromString(grossPay.toFixed(2)),
        },
        deductions: {
          lateDeductions: mongoose.Types.Decimal128.fromString('0.00'),
          unpaidLeaveDeductions: mongoose.Types.Decimal128.fromString('0.00'),
          taxPlaceholder: mongoose.Types.Decimal128.fromString('0.00'),
          loanEmiPlaceholder: mongoose.Types.Decimal128.fromString(emiDeduction.toFixed(2)),
          totalDeductions: mongoose.Types.Decimal128.fromString(totalDeductions.toFixed(2)),
        },
        netPay: mongoose.Types.Decimal128.fromString(netPay.toFixed(2)),
        status: 'DRAFT',
      });

      await payslip.save({ session });

      // 4. Create LoanRepayment audit document inside Session
      if (repaymentAudit && emiDeduction > 0) {
        const repayment = new LoanRepayment({
          companyId,
          loanId: repaymentAudit.loanId,
          employeeId: emp._id,
          payslipId: payslip._id,
          amount: mongoose.Types.Decimal128.fromString(emiDeduction.toFixed(2)),
          principalBefore: mongoose.Types.Decimal128.fromString(
            repaymentAudit.principalBefore.toFixed(2)
          ),
          principalAfter: mongoose.Types.Decimal128.fromString(
            repaymentAudit.principalAfter.toFixed(2)
          ),
          repaymentDate: new Date(),
        });

        await repayment.save({ session });
      }

      generatedPayslips.push(payslip);
    }

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json(
      new ApiResponse(
        201,
        generatedPayslips,
        'Monthly payroll processed and loan EMIs deducted atomically.'
      )
    );
  } catch (error) {
    // Rollback changes on any failure
    await session.abortTransaction();
    session.endSession();
    throw new ApiError(500, `Payroll batch failed. Rolled back all changes: ${error.message}`);
  }
});