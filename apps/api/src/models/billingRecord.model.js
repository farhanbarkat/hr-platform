import mongoose, { Schema } from 'mongoose';

const billingRecordSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required.'],
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan reference is required.'],
    },
    billingPeriod: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [0, 'Amount cannot be negative.'],
    },
    currency: {
      type: String,
      default: 'PKR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export const BillingRecord = mongoose.model('BillingRecord', billingRecordSchema);