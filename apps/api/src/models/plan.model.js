import mongoose, { Schema } from 'mongoose';

const planSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required.'],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Plan code is required.'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    employeeLimit: {
      type: Number,
      required: [true, 'Employee limit is required.'],
      min: [1, 'Limit must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required.'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'PKR',
      uppercase: true,
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      default: 'MONTHLY',
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Plan = mongoose.model('Plan', planSchema);