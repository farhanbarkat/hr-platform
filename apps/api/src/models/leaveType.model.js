import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Leave type name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Leave type code is required'],
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    defaultAllotment: {
      type: Number,
      required: [true, 'Default annual allotment is required'],
      min: [0, 'Allotment cannot be negative'],
      default: 10,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    carryForwardMax: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false, // true for system defaults (CASUAL, SICK, ANNUAL)
    },
  },
  { timestamps: true }
);

// Enforce unique leave type code per company
leaveTypeSchema.index({ companyId: 1, code: 1 }, { unique: true });

export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema); 