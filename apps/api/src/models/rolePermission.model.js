import mongoose from 'mongoose';

/**
 * RolePermissions Model
 * 
 * Allows per-company override of default role permissions.
 * If no document exists for a company+role, defaults from permissions.js are used.
 */
const rolePermissionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
      required: true,
    },
    permissions: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one override per company+role
rolePermissionSchema.index({ companyId: 1, role: 1 }, { unique: true });

// Static method to get effective permissions for a role in a company
rolePermissionSchema.statics.getEffectivePermissions = async function (
  companyId,
  role
) {
  const { getDefaultPermissionsForRole } = await import('../config/permissions.js');

  const override = await this.findOne({ companyId, role }).lean();

  if (override) {
    return override.permissions;
  }

  return getDefaultPermissionsForRole(role);
};

// Static method to set/reset override
rolePermissionSchema.statics.setOverride = async function (
  companyId,
  role,
  permissions,
  updatedBy
) {
  if (permissions.length === 0) {
    // Empty array = reset to defaults (delete override)
    await this.findOneAndDelete({ companyId, role });
    return null;
  }

  return this.findOneAndUpdate(
    { companyId, role },
    { permissions, updatedBy, updatedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);
