import mongoose, { Schema } from 'mongoose';

const operationalExpenseSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['RENT', 'UTILITIES', 'SOFTWARE_LICENSES', 'MARKETING', 'LEGAL', 'OFFICE_SUPPLIES', 'MISCELLANEOUS'],
      default: 'MISCELLANEOUS',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    period: {
      month: { type: Number, required: true }, // 1 - 12
      year: { type: Number, required: true },  // e.g. 2026
    },
    monthYear: {
      type: String, // "2026-08"
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for fast monthly aggregation queries
operationalExpenseSchema.index({ companyId: 1, monthYear: 1, category: 1 });
operationalExpenseSchema.index({ companyId: 1, 'period.year': 1, 'period.month': 1 });

export const OperationalExpense = mongoose.model('OperationalExpense', operationalExpenseSchema);