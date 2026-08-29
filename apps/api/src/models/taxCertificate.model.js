import mongoose, { Schema } from 'mongoose';

const taxCertificateSchema = new Schema(
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
    taxYear: {
      type: String,
      required: true,
      trim: true,
      default: '2026-2027',
    },
    certificateNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    totalGrossIncome: {
      type: mongoose.Decimal128,
      default: 0.0,
    },
    totalTaxableIncome: {
      type: mongoose.Decimal128,
      default: 0.0,
    },
    totalTaxPaid: {
      type: mongoose.Decimal128,
      required: true,
      default: 0.0,
    },
    monthlyBreakdown: [
      {
        monthYear: { type: String, required: true }, // e.g. "2026-07"
        grossPay: { type: Number, default: 0 },
        taxDeduction: { type: Number, default: 0 },
        payslipId: { type: Schema.Types.ObjectId, ref: 'Payslip' },
      },
    ],
    s3Key: {
      type: String,
      default: null,
    },
    s3Url: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    jobId: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    generatedAt: {
      type: Date,
      default: null,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index per employee per tax year
taxCertificateSchema.index({ companyId: 1, employeeId: 1, taxYear: 1 }, { unique: true });

export const TaxCertificate = mongoose.model('TaxCertificate', taxCertificateSchema);