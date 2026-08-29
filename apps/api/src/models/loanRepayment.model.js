import mongoose, { Schema } from 'mongoose';

const loanRepaymentSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    loanId: {
      type: Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    payslipId: {
      type: Schema.Types.ObjectId,
      ref: 'Payslip',
      required: true,
      index: true,
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    repaymentDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    principalBefore: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    principalAfter: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    status: {
      type: String,
      enum: ['APPLIED', 'REVERSED'],
      default: 'APPLIED',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (ret.amount) ret.amount = parseFloat(ret.amount.toString());
        if (ret.principalBefore) ret.principalBefore = parseFloat(ret.principalBefore.toString());
        if (ret.principalAfter) ret.principalAfter = parseFloat(ret.principalAfter.toString());
        return ret;
      },
    },
  }
);

loanRepaymentSchema.index({ companyId: 1, loanId: 1, repaymentDate: -1 });

export const LoanRepayment = mongoose.model('LoanRepayment', loanRepaymentSchema);