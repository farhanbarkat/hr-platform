import mongoose, { Schema } from 'mongoose';

const slabBracketSchema = new Schema(
  {
    minIncome: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    maxIncome: {
      type: Number,
      default: null, // null represents no upper limit (infinity)
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0, // In percentage e.g., 5 for 5%
    },
    fixedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const taxSlabSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'PK',
    },
    taxYear: {
      type: String,
      required: true,
      trim: true,
      default: '2026-2027',
    },
    frequency: {
      type: String,
      enum: ['ANNUAL', 'MONTHLY'],
      default: 'ANNUAL',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Progressive Brackets
    slabs: {
      type: [slabBracketSchema],
      validate: {
        validator: function (brackets) {
          return Array.isArray(brackets) && brackets.length > 0;
        },
        message: 'At least one tax slab bracket must be defined.',
      },
    },
    // Configurable Exemptions & Rebates
    standardExemption: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxFreeAllowance: {
      type: Number,
      default: 0,
      min: 0,
    },
    rebatePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique active tax config per company, country, and tax year
taxSlabSchema.index({ companyId: 1, country: 1, taxYear: 1, isActive: 1 });

export const TaxSlab = mongoose.model('TaxSlab', taxSlabSchema);