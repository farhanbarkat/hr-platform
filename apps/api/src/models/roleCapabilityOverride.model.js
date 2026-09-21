import mongoose, { Schema } from 'mongoose';

const roleCapabilityOverrideSchema = new Schema(
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
    // ✅ Extra granted powers
    grantedPermissions: [
      {
        type: String,
        trim: true,
      },
    ],
    // ✅ Restricted powers
    removedPermissions: [
      {
        type: String,
        trim: true,
      },
    ],
    jobTitle: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      required: [true, 'A reason is required explaining capability changes.'],
      trim: true,
      default: 'Delegated operational authority by Company Admin',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One override record per employee per company
roleCapabilityOverrideSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

export const RoleCapabilityOverride = mongoose.model(
  'RoleCapabilityOverride',
  roleCapabilityOverrideSchema
);