import mongoose, { Schema } from 'mongoose';

const offboardingSchema = new Schema(
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
    initiatedType: {
      type: String,
      enum: ['self-resignation', 'hr-termination'],
      required: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resignationDate: {
      type: Date,
      default: Date.now,
    },
    lastWorkingDate: {
      type: Date,
      required: true,
    },
    noticePeriodDays: {
      type: Number,
      default: 30,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'submitted',
        'acknowledged',
        'clearanceInProgress',
        'cleared',
        'settled',
        'exited',
        'rejected',
      ],
      default: 'submitted',
      index: true,
    },
    exitInterviewNotes: {
      type: String,
      default: '',
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    // Final Settlement Details
    settlementDetails: {
      proratedBasicPay: { type: Number, default: 0 },
      proratedGrossSalary: { type: Number, default: 0 },
      encashedLeavesCount: { type: Number, default: 0 },
      leaveEncashmentAmount: { type: Number, default: 0 },
      outstandingLoanDeduction: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      netSettlementAmount: { type: Number, default: 0 },
      isNegativeBalance: { type: Boolean, default: false },
      settledAt: { type: Date, default: null },
      settledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      remarks: { type: String, default: '' },
    },
    // Letters & Artifacts (TICKET-022B1 Engine)
    resignationAcceptanceUrl: { type: String, default: null },
    relievingLetterUrl: { type: String, default: null },
    experienceLetterUrl: { type: String, default: null },
    secureAccessToken: {
      type: String,
      default: null,
      index: true,
    },
    secureTokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

offboardingSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });

export const Offboarding = mongoose.model('Offboarding', offboardingSchema);