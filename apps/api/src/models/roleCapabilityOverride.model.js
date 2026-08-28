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
    // Only permissions to REMOVE from their base role permissions
    removedPermissions: [
      {
        type: String,
        trim: true,
        required: true,
      },
    ],
    reason: {
      type: String,
      required: [true, 'A reason is required explaining why permissions are being restricted.'],
      trim: true,
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

// Ensure one override record per employee per company
roleCapabilityOverrideSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

export const RoleCapabilityOverride = mongoose.model(
  'RoleCapabilityOverride',
  roleCapabilityOverrideSchema
);