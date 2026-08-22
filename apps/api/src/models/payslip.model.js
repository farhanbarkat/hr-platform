import mongoose from 'mongoose';

const payslipSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: [true, 'Payroll Run ID is required'],
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
      index: true,
    },
    period: {
      year: { type: Number, required: true },
      month: { type: Number, required: true },
    },
    earnings: {
      basicSalary: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      allowances: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      overtimePay: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      grossPay: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
      },
    },
    deductions: {
      lateDeductions: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      unpaidLeaveDeductions: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      taxPlaceholder: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      loanEmiPlaceholder: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0.00'),
      },
      totalDeductions: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
      },
    },
    netPay: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    attendanceSummary: {
      presentDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      lateMinutes: { type: Number, default: 0 },
      overtimeMinutes: { type: Number, default: 0 },
      unpaidLeaveDays: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'CALCULATED', 'APPROVED', 'PAID'],
      default: 'DRAFT',
    },
  },
  { timestamps: true }
);

payslipSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });
payslipSchema.index({ companyId: 1, employeeId: 1, 'period.year': 1, 'period.month': 1 });

export const Payslip = mongoose.model('Payslip', payslipSchema);