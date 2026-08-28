import mongoose, { Schema } from 'mongoose';

const promotionRecordSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required.'],
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required.'],
      index: true,
    },
    previousDesignation: {
      type: String,
      required: true,
      trim: true,
    },
    newDesignation: {
      type: String,
      required: [true, 'New designation is required.'],
      trim: true,
    },
    previousDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    newDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    previousSalaryStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      default: null,
    },
    proposedSalary: {
      baseSalary: { type: Number, required: true },
      allowances: [
        {
          name: { type: String, required: true },
          amount: { type: Number, required: true },
          isTaxable: { type: Boolean, default: true },
        },
      ],
      deductions: [
        {
          name: { type: String, required: true },
          amount: { type: Number, required: true },
        },
      ],
      grossSalary: { type: Number, required: true },
      netSalary: { type: Number, required: true },
      currency: { type: String, default: 'PKR' },
    },
    newSalaryStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'SalaryStructure',
      default: null,
    },
    effectiveDate: {
      type: Date,
      required: [true, 'Effective date is required.'],
    },
    justification: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['proposed', 'offerSent', 'accepted', 'declined', 'cancelled'],
      default: 'proposed',
      index: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    letterArtifactUrl: {
      type: String,
      default: null,
    },
    letterHtmlContent: {
      type: String,
      default: null,
    },
    employeeResponseDate: {
      type: Date,
      default: null,
    },
    employeeRemarks: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Optimized compound indexes for tenant & employee queries
promotionRecordSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });
promotionRecordSchema.index({ companyId: 1, status: 1 });

export const PromotionRecord = mongoose.model('PromotionRecord', promotionRecordSchema);