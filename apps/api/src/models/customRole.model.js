import mongoose, { Schema } from 'mongoose';

const customRoleSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Role name is required.'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    basedOnSystemRole: {
      type: String,
      enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
      default: 'EMPLOYEE',
    },
    permissions: [
      {
        type: String,
        trim: true,
        required: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Har company ke andar role name unique hoga (Company A ka HOD Company B par asar nahi karega)
customRoleSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const CustomRole = mongoose.model('CustomRole', customRoleSchema);