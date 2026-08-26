import mongoose, { Schema } from 'mongoose';

const leaveStatusHistorySchema = new Schema(
  {
    leaveRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveRequest',
      required: [true, 'LeaveRequest reference is required.'],
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      enum: ['NONE', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED', 'ESCALATED'],
      default: 'NONE',
    },
    toStatus: {
      type: String,
      enum: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED', 'ESCALATED'],
      required: [true, 'Target status is required.'],
    },
    actedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Can be null on system-automated actions
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for timeline lookups
leaveStatusHistorySchema.index({ leaveRequestId: 1, timestamp: 1 });

export const LeaveStatusHistory = mongoose.model(
  'LeaveStatusHistory',
  leaveStatusHistorySchema
);