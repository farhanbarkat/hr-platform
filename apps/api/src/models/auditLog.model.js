import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    targetResource: {
      type: String,
      trim: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);