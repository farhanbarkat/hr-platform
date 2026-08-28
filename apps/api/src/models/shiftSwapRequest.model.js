import mongoose, { Schema } from 'mongoose';

const shiftSwapRequestSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    targetEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    requesterShiftAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftAssignment',
      required: true,
    },
    targetShiftAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftAssignment',
      required: true,
    },
    swapDate: {
      type: Date,
      required: [true, 'Swap date is required.'],
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'PENDING_PEER_ACCEPTANCE',
        'PEER_REJECTED',
        'PENDING_MANAGER_APPROVAL',
        'MANAGER_REJECTED',
        'APPROVED',
        'EXPIRED',
        'CANCELLED',
      ],
      default: 'PENDING_PEER_ACCEPTANCE',
      index: true,
    },
    peerActionAt: {
      type: Date,
      default: null,
    },
    peerComments: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvalActionAt: {
      type: Date,
      default: null,
    },
    managerComments: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

shiftSwapRequestSchema.index({ companyId: 1, requesterId: 1, status: 1 });
shiftSwapRequestSchema.index({ companyId: 1, targetEmployeeId: 1, status: 1 });

export const ShiftSwapRequest = mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema);