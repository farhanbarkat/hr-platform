import mongoose, { Schema } from 'mongoose';

const shiftAssignmentSchema = new Schema(
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
    shiftTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftTemplate',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null, // null means ongoing / indefinite
    },
    inchargeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee', // Shift incharge / Supervisor (powers TICKET-024 dashboard)
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

shiftAssignmentSchema.index({ companyId: 1, employeeId: 1, startDate: 1, endDate: 1 });

export const ShiftAssignment = mongoose.model('ShiftAssignment', shiftAssignmentSchema);