import mongoose from 'mongoose';

const payrollRunSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    period: {
      year: {
        type: Number,
        required: [true, 'Payroll year is required'],
      },
      month: {
        type: Number,
        required: [true, 'Payroll month is required (1-12)'],
        min: 1,
        max: 12,
      },
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'FAILED'],
      default: 'DRAFT',
      index: true,
    },
    totalGross: {
      type: mongoose.Schema.Types.Decimal128,
      default: mongoose.Types.Decimal128.fromString('0.00'),
    },
    totalDeductions: {
      type: mongoose.Schema.Types.Decimal128,
      default: mongoose.Types.Decimal128.fromString('0.00'),
    },
    totalNet: {
      type: mongoose.Schema.Types.Decimal128,
      default: mongoose.Types.Decimal128.fromString('0.00'),
    },
    employeeCount: {
      type: Number,
      default: 0,
    },
    validationErrors: [
      {
        employeeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Employee',
        },
        employeeName: String,
        reason: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One payroll run per month per company
payrollRunSchema.index(
  { companyId: 1, 'period.year': 1, 'period.month': 1 },
  { unique: true }
);

export const PayrollRun = mongoose.model('PayrollRun', payrollRunSchema);