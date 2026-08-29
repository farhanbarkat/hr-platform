import mongoose, { Schema } from 'mongoose';

const loanSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    principal: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    monthlyEmi: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    remainingBalance: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    tenureMonths: {
      type: Number,
      required: true,
    },
    purpose: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['APPLIED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
      default: 'APPLIED',
      index: true,
    },
    disbursementDate: {
      type: Date,
      default: null,
    },
    expectedPayoffDate: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    approvalFlags: [
      {
        code: String,
        message: String,
        severity: {
          type: String,
          enum: ['INFO', 'WARNING', 'CRITICAL'],
          default: 'WARNING',
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (ret.principal) ret.principal = parseFloat(ret.principal.toString());
        if (ret.monthlyEmi) ret.monthlyEmi = parseFloat(ret.monthlyEmi.toString());
        if (ret.remainingBalance) ret.remainingBalance = parseFloat(ret.remainingBalance.toString());
        return ret;
      },
    },
  }
);

loanSchema.index({ companyId: 1, employeeId: 1, status: 1 });

export const Loan = mongoose.model('Loan', loanSchema);