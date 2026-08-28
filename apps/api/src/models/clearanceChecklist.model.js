import mongoose, { Schema } from 'mongoose';

const clearanceChecklistItemSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    offboardingId: {
      type: Schema.Types.ObjectId,
      ref: 'Offboarding',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['assetReturn', 'financeClearance', 'itAccessRevoked', 'hrClearance'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'waived'],
      default: 'pending',
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export const ClearanceChecklistItem = mongoose.model('ClearanceChecklistItem', clearanceChecklistItemSchema);