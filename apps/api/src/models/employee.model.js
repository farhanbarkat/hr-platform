 import mongoose, { Schema } from 'mongoose';

const employeeSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    // Personal Details
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    cnic: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    // Job Details (HR / Admin Only)
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    dateOfJoining: {
      type: Date,
      required: true,
    },
    employmentStatus: {
      type: String,
      enum: ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'],
      default: 'PROBATION',
    },
  },
  { timestamps: true }
);

// Compound Unique Indexes scoped by Company
employeeSchema.index({ companyId: 1, email: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, cnic: 1 }, { unique: true });

export const Employee = mongoose.model('Employee', employeeSchema);
