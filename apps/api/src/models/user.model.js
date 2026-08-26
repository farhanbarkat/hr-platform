import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
      default: 'EMPLOYEE',
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorRecoveryCodes: [
      {
        codeHash: { type: String, required: true },
        used: { type: Boolean, default: false },
      },
    ],
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.twoFactorSecret;
    delete ret.twoFactorRecoveryCodes;
    delete ret.refreshTokens;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);