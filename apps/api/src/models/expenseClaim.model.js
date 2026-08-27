import mongoose, { Schema } from 'mongoose';

const expenseClaimSchema = new Schema(
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
    category: {
      type: String,
      required: true,
      trim: true,
      enum: ['TRAVEL', 'MEALS', 'EQUIPMENT', 'OFFICE_SUPPLIES', 'TRAINING', 'OTHER'],
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
      min: 0.01,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    receiptDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actionDate: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying employee claims and company review queues efficiently
expenseClaimSchema.index({ companyId: 1, status: 1 });
expenseClaimSchema.index({ companyId: 1, employeeId: 1, status: 1 });

export const ExpenseClaim = mongoose.model('ExpenseClaim', expenseClaimSchema);