import mongoose, { Schema } from 'mongoose';

const variablePayrollInputSchema = new Schema(
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
    month: {
      type: Number, // 1 - 12
      required: true,
      min: [1, 'Month must be between 1 and 12.'],
      max: [12, 'Month must be between 1 and 12.'],
    },
    year: {
      type: Number, // e.g. 2026
      required: true,
    },
    unitsWorked: {
      type: Number,
      default: 0,
      min: [0, 'Units worked cannot be negative.'],
    },
    metricValue: {
      type: Number,
      default: 0,
      min: [0, 'Metric value cannot be negative.'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensures only one variable record exists per employee per month within a company
variablePayrollInputSchema.index(
  { companyId: 1, employeeId: 1, month: 1, year: 1 },
  { unique: true }
);

export const VariablePayrollInput =
  mongoose.models.VariablePayrollInput ||
  mongoose.model('VariablePayrollInput', variablePayrollInputSchema);