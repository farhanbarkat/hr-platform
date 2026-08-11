import mongoose from 'mongoose';

/**
 * AccessLog Model
 * 
 * Logs all authorization attempts (allowed and denied) for audit trail.
 */
const accessLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    permission: {
      type: String,
      required: true,
      index: true,
    },
    allowed: {
      type: Boolean,
      required: true,
      default: false,
    },
    resourceType: {
      type: String,
      enum: ['leave', 'loan', 'shift_swap', 'payroll', 'expense', 'advance', 'other'],
      default: 'other',
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    ipAddress: String,
    userAgent: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Index for querying by company + time range
accessLogSchema.index({ companyId: 1, createdAt: -1 });

// Index for querying by user + permission
accessLogSchema.index({ userId: 1, permission: 1, createdAt: -1 });

// Static method to log an access attempt
accessLogSchema.statics.logAttempt = async function (data) {
  try {
    await this.create(data);
  } catch (err) {
    // Never throw on logging failure - just console.error
    console.error('Failed to write access log:', err.message);
  }
};

export const AccessLog = mongoose.model('AccessLog', accessLogSchema);
