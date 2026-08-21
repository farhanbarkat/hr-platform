import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
      index: true,
    },
    leaveTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: [true, 'Leave Type ID is required'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      default: () => new Date().getFullYear(),
    },
    allotted: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Allotted leaves cannot be negative'],
    },
    used: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Used leaves cannot be negative'],
    },
    pending: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Pending leaves cannot be negative'],
    },
    remaining: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

// Enforce single document per employee per leave type per year
leaveBalanceSchema.index(
  { companyId: 1, employeeId: 1, leaveTypeId: 1, year: 1 },
  { unique: true }
);

export const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);