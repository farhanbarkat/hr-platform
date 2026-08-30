import mongoose, { Schema } from 'mongoose';

const companyIncomeSchema = new Schema(
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
    source: {
      type: String,
      enum: ['CLIENT_RETAINER', 'PROJECT_BILLING', 'SUBSCRIPTIONS', 'INVESTMENT', 'CONSULTING', 'OTHER_INCOME'],
      default: 'CLIENT_RETAINER',
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
      month: { type: Number, required: true },
      year: { type: Number, required: true },
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

// Compound index for performant aggregation
companyIncomeSchema.index({ companyId: 1, monthYear: 1, source: 1 });
companyIncomeSchema.index({ companyId: 1, 'period.year': 1, 'period.month': 1 });

export const CompanyIncome = mongoose.model('CompanyIncome', companyIncomeSchema);