import mongoose from 'mongoose';
import { PayrollRun } from '../models/payrollRun.model.js';
import { Payslip } from '../models/payslip.model.js';
import { Employee } from '../models/employee.model.js';
import { AttendanceRecord } from '../models/attendance.model.js';
import { Company } from '../models/company.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Helper to safely convert numbers/strings to Decimal128 with 2 decimal precision
 */
const toDecimal128 = (num) => {
  const val = Number(num || 0).toFixed(2);
  return mongoose.Types.Decimal128.fromString(val);
};

export const calculatePayrollRunOrchestrator = async (companyId, payrollRunId) => {
  const run = await PayrollRun.findOne({ _id: payrollRunId, companyId });
  if (!run) {
    throw new ApiError(404, 'Payroll run not found.');
  }

  if (run.status === 'APPROVED' || run.status === 'PAID') {
    throw new ApiError(400, 'Cannot re-calculate an approved or paid payroll run.');
  }

  const company = await Company.findById(companyId);
  const { startDate, endDate, year, month } = run.period;

  // 1. Fetch all active employees
  const employees = await Employee.find({
    companyId,
    $or: [{ status: 'ACTIVE' }, { status: 'active' }, { status: { $exists: false } }],
  }).populate('userId', 'name email').lean();

  if (employees.length === 0) {
    throw new ApiError(400, 'No active employees found for payroll calculation.');
  }

  // 2. Pre-flight Validation: Collect all missing data errors across all employees
  const validationErrors = [];
  const validEmployeeProfiles = [];

  for (const emp of employees) {
    const empName = emp.userId?.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown Employee';
    const basicSalary = emp.salaryStructure?.basicSalary || emp.basicSalary;

    if (!basicSalary || Number(basicSalary) <= 0) {
      validationErrors.push({
        employeeId: emp._id,
        employeeName: empName,
        reason: 'Missing or zero basic salary in salary structure configuration.',
      });
      continue;
    }

    validEmployeeProfiles.push({ emp, basicSalary: Number(basicSalary), empName });
  }

  // If ANY employee fails pre-flight validation, abort immediately and persist errors to DRAFT run
  if (validationErrors.length > 0) {
    run.status = 'DRAFT';
    run.validationErrors = validationErrors;
    await run.save();

    throw new ApiError(
      422,
      `Payroll calculation blocked: ${validationErrors.length} employee(s) have missing required data.`,
      validationErrors
    );
  }

  // 3. Calculation & Atomic Payslip Generation
  const standardWorkingDays = 30; // standard month baseline
  const payslipBulkOps = [];
  let totalGrossSum = 0;
  let totalDeductionsSum = 0;
  let totalNetSum = 0;

  for (const item of validEmployeeProfiles) {
    const { emp, basicSalary } = item;
    const allowances = Number(emp.salaryStructure?.allowances || 0);

    // Fetch employee attendance for this exact month period
    const attendanceRecords = await AttendanceRecord.find({
      companyId,
      employeeId: emp._id,
      date: { $gte: startDate, $lte: endDate },
    });

    let lateMinutesTotal = 0;
    let overtimeMinutesTotal = 0;
    let presentDaysCount = 0;
    let absentDaysCount = 0;

    for (const record of attendanceRecords) {
      if (record.status === 'PRESENT' || record.status === 'LATE') {
        presentDaysCount += 1;
        lateMinutesTotal += record.lateMinutes || 0;
        overtimeMinutesTotal += record.overtimeMinutes || 0;
      } else if (record.status === 'HALF_DAY') {
        presentDaysCount += 0.5;
        absentDaysCount += 0.5;
      } else if (record.status === 'ABSENT') {
        absentDaysCount += 1;
      }
    }

    // Mathematical calculations using standard hourly/minute breakdown
    const perDayRate = basicSalary / standardWorkingDays;
    const perMinuteRate = perDayRate / 8 / 60; // 8 hours shift

    // Late penalty: standard per-minute deduction past grace
    const lateDeduction = Number((lateMinutesTotal * perMinuteRate).toFixed(2));
    const unpaidLeaveDeduction = Number((absentDaysCount * perDayRate).toFixed(2));
    const overtimePay = Number((overtimeMinutesTotal * perMinuteRate * 1.5).toFixed(2)); // 1.5x OT rate

    const taxPlaceholder = 0.0;
    const loanEmiPlaceholder = 0.0;

    const grossPay = Number((basicSalary + allowances + overtimePay).toFixed(2));
    const totalDeductions = Number(
      (lateDeduction + unpaidLeaveDeduction + taxPlaceholder + loanEmiPlaceholder).toFixed(2)
    );
    const netPay = Math.max(0, Number((grossPay - totalDeductions).toFixed(2)));

    totalGrossSum += grossPay;
    totalDeductionsSum += totalDeductions;
    totalNetSum += netPay;

    payslipBulkOps.push({
      updateOne: {
        filter: { payrollRunId: run._id, employeeId: emp._id },
        update: {
          $set: {
            companyId,
            payrollRunId: run._id,
            employeeId: emp._id,
            period: { year, month },
            earnings: {
              basicSalary: toDecimal128(basicSalary),
              allowances: toDecimal128(allowances),
              overtimePay: toDecimal128(overtimePay),
              grossPay: toDecimal128(grossPay),
            },
            deductions: {
              lateDeductions: toDecimal128(lateDeduction),
              unpaidLeaveDeductions: toDecimal128(unpaidLeaveDeduction),
              taxPlaceholder: toDecimal128(taxPlaceholder),
              loanEmiPlaceholder: toDecimal128(loanEmiPlaceholder),
              totalDeductions: toDecimal128(totalDeductions),
            },
            netPay: toDecimal128(netPay),
            attendanceSummary: {
              presentDays: presentDaysCount,
              absentDays: absentDaysCount,
              lateMinutes: lateMinutesTotal,
              overtimeMinutes: overtimeMinutesTotal,
              unpaidLeaveDays: absentDaysCount,
            },
            status: 'CALCULATED',
          },
        },
        upsert: true,
      },
    });
  }

  // Execute bulk payslips insertion atomically
  try {
    await Payslip.bulkWrite(payslipBulkOps);

    // Update payroll run status to CALCULATED
    run.status = 'CALCULATED';
    run.validationErrors = [];
    run.employeeCount = validEmployeeProfiles.length;
    run.totalGross = toDecimal128(totalGrossSum);
    run.totalDeductions = toDecimal128(totalDeductionsSum);
    run.totalNet = toDecimal128(totalNetSum);
    await run.save();

    return {
      run,
      calculatedPayslipsCount: payslipBulkOps.length,
    };
  } catch (dbError) {
    // Safety guarantee: If DB bulk write fails partway, keep run in DRAFT/FAILED status
    run.status = 'FAILED';
    await run.save();
    throw new ApiError(500, `Payroll calculation failed during payslip generation: ${dbError.message}`);
  }
};