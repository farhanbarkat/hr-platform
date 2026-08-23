import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

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
    // --- NAYE FIELDS FOR TICKET-016 (PDF & Storage) ---
    pdfS3Key: {
      type: String,
      default: null,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    pdfGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

payslipSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });
payslipSchema.index({ companyId: 1, employeeId: 1, 'period.year': 1, 'period.month': 1 });

// --- IMMUTABILITY GUARD (DATABASE LAYER) ---
const allowedPdfFields = ['pdfS3Key', 'pdfUrl', 'pdfGeneratedAt'];

payslipSchema.pre('save', async function (next) {
  if (!this.isNew && this.isModified()) {
    if (this.isModified('status')) return next();

    if (this.status === 'APPROVED' || this.status === 'PAID') {
      const modified = this.modifiedPaths();
      const isOnlyPdf = modified.every((p) => allowedPdfFields.includes(p));
      if (!isOnlyPdf) {
        throw new ApiError(
          400,
          'IMMUTABLE_RECORD: Cannot modify a payslip once it is APPROVED or PAID. Post-approval adjustments must be recorded using PayslipAdjustment.'
        );
      }
    }
  }
  next();
});

// Query execution standard handler block without fragile next parameter bindings
payslipSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], async function () {
  const options = this.getOptions();
  if (options && options.bypassImmutability) {
    return;
  }

  const update = this.getUpdate() || {};
  const targetPayload = update.$set || update;
  const updateKeys = Object.keys(targetPayload);

  const isOnlyPdfUpdate = updateKeys.length > 0 && updateKeys.every((k) => allowedPdfFields.includes(k));
  if (isOnlyPdfUpdate) {
    return;
  }

  const docToUpdate = await this.model.findOne(this.getQuery());
  if (docToUpdate && (docToUpdate.status === 'APPROVED' || docToUpdate.status === 'PAID')) {
    throw new ApiError(
      400,
      'IMMUTABLE_RECORD: Cannot modify a payslip once it is APPROVED or PAID. Post-approval adjustments must be recorded using PayslipAdjustment.'
    );
  }
});
export const Payslip = mongoose.model('Payslip', payslipSchema);