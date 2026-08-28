import mongoose, { Schema } from 'mongoose';

const shiftTemplateSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String, // Format: "HH:mm" (e.g., "09:00", "18:00")
      required: true,
    },
    endTime: {
      type: String, // Format: "HH:mm" (e.g., "17:00", "02:00")
      required: true,
    },
    gracePeriodOverride: {
      type: Number, // Grace period in minutes for late calculation
      default: null,
    },
    isNightShift: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

shiftTemplateSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const ShiftTemplate = mongoose.model('ShiftTemplate', shiftTemplateSchema);