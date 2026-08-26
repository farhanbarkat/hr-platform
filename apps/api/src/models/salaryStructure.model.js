import mongoose, { Schema } from 'mongoose';

const allowanceSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Allowance name is required'],
      trim: true,
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Allowance amount is required'],
    },
    isTaxable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const salaryStructureSchema = new Schema(
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
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective date is required'],
      index: true,
    },
    currency: {
      type: String,
      default: 'PKR',
      trim: true,
      uppercase: true,
    },
    basicPay: {
      type: Schema.Types.Decimal128,
      required: [true, 'Basic pay is required'],
    },
    allowances: [allowanceSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for high-speed chronological snapshot queries
salaryStructureSchema.index({ employeeId: 1, effectiveFrom: -1 });

export const SalaryStructure = mongoose.model('SalaryStructure', salaryStructureSchema);