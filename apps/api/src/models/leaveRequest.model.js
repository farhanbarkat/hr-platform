import mongoose from 'mongoose';
import { LeaveStatusHistory } from './leaveStatusHistory.model.js';

const leaveRequestSchema = new mongoose.Schema(
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
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    totalDays: {
      type: Number,
      required: true,
      min: [0.5, 'Minimum leave is 0.5 days'],
    },
    dayType: {
      type: String,
      enum: ['FULL', 'HALF_FIRST', 'HALF_SECOND'],
      default: 'FULL',
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING_MANAGER',
      index: true,
    },
    // Manager stage audit
    managerApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    managerApprovedAt: {
      type: Date,
      default: null,
    },
    managerNotes: {
      type: String,
      default: '',
    },
    // HR stage audit
    hrApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    hrApprovedAt: {
      type: Date,
      default: null,
    },
    hrNotes: {
      type: String,
      default: '',
    },
    // Flags
    isEscalatedToHr: {
      type: Boolean,
      default: false,
    },
    isUnpaidOverride: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ companyId: 1, employeeId: 1, status: 1 });
leaveRequestSchema.index({ companyId: 1, status: 1 });

// Cache previous status on document load
leaveRequestSchema.post('init', function () {
  this._originalStatus = this.status;
});

// Flag status changes prior to save
leaveRequestSchema.pre('save', function () {
  if (this.isModified('status')) {
    this._statusChanged = true;
    this._previousStatus = this.isNew ? 'NONE' : this._originalStatus || 'PENDING_MANAGER';
  }
});

// Automated status transition audit creation
leaveRequestSchema.post('save', async function (doc) {
  if (doc._statusChanged) {
    try {
      let resolvedActor = null;
      let resolvedNote = '';

      if (doc.isNew) {
        resolvedNote = doc.reason ? `Submitted: ${doc.reason}` : 'Leave request submitted';
      } else if (doc.status === 'PENDING_HR') {
        resolvedActor = doc.managerApprovedBy || null;
        resolvedNote = doc.managerNotes || 'Approved by Manager, forwarded to HR';
      } else if (doc.status === 'APPROVED') {
        resolvedActor = doc.hrApprovedBy || doc.managerApprovedBy || null;
        resolvedNote = doc.hrNotes || 'Leave request approved';
      } else if (doc.status === 'REJECTED') {
        resolvedActor = doc.rejectedBy || doc.hrApprovedBy || doc.managerApprovedBy || null;
        resolvedNote = doc.rejectionReason || 'Leave request rejected';
      } else if (doc.status === 'CANCELLED') {
        resolvedNote = 'Leave request cancelled by employee';
      }

      await LeaveStatusHistory.create({
        leaveRequestId: doc._id,
        companyId: doc.companyId,
        fromStatus: doc._previousStatus || 'NONE',
        toStatus: doc.status,
        actedBy: doc._actedBy || resolvedActor,
        note: doc._statusNote || resolvedNote,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('Failed to log LeaveStatusHistory in post-save hook:', err.message);
    }
  }
});

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);