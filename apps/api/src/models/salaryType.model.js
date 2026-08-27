import mongoose, { Schema } from 'mongoose';

const salaryTypeSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Salary type name is required.'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['FIXED', 'PER_UNIT', 'PERFORMANCE_BASED'],
      required: [true, 'Salary type enum is required.'],
      index: true,
    },
    // Per-Unit Configuration
    perUnitConfig: {
      unitLabel: {
        type: String,
        trim: true,
        default: 'unit', // e.g. "piece", "hour", "call"
      },
      ratePerUnit: {
        type: Number,
        default: 0,
        min: [0, 'Rate per unit cannot be negative.'],
      },
    },
    // Performance-Based Configuration
    performanceConfig: {
      basePay: {
        type: Number,
        default: 0,
        min: [0, 'Base pay cannot be negative.'],
      },
      bonusPercent: {
        type: Number,
        default: 0,
        min: [0, 'Bonus percent cannot be negative.'],
      },
      metricSource: {
        type: String,
        trim: true,
        default: 'sales', // e.g. "sales", "deals_closed", "revenue"
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

salaryTypeSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const SalaryType =
  mongoose.models.SalaryType || mongoose.model('SalaryType', salaryTypeSchema);