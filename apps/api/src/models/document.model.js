import mongoose, { Schema } from 'mongoose';

const documentSchema = new Schema(
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
    documentType: {
      type: String,
      enum: ['CONTRACT', 'CNIC', 'CERTIFICATE', 'RESUME', 'OTHER'],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
      unique: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING_SCAN', 'AVAILABLE', 'QUARANTINED'],
      default: 'PENDING_SCAN',
      index: true,
    },
    scanResult: {
      isClean: { type: Boolean, default: null },
      scannedAt: { type: Date },
      details: { type: String },
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true, // For cron/reminder jobs
    },
  },
  { timestamps: true }
);

// Indexes for tenant queries and expiry reminders
documentSchema.index({ companyId: 1, employeeId: 1, status: 1 });

export const Document = mongoose.model('Document', documentSchema);