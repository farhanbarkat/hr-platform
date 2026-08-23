import mongoose, { Schema } from 'mongoose';

const payslipAdjustmentSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    payslipId: {
      type: Schema.Types.ObjectId,
      ref: 'Payslip',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    payrollRunId: {
      type: Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
    },
    type: {
      type: String,
      enum: ['ADDITION', 'DEDUCTION'],
      required: true,
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for post-approval adjustment is mandatory'],
      trim: true,
    },
    appliedInNextPayroll: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PayslipAdjustment = mongoose.model('PayslipAdjustment', payslipAdjustmentSchema);