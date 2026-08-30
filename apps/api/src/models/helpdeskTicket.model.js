import mongoose, { Schema } from 'mongoose';

const helpdeskTicketSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Ticket title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Ticket description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['PAYROLL', 'ATTENDANCE', 'LEAVE', 'BENEFITS', 'GENERAL_HR', 'IT_SUPPORT'],
      required: [true, 'Category is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Optional attachment reference to specific platform records
    attachedRecord: {
      recordType: {
        type: String,
        enum: ['ATTENDANCE', 'PAYSLIP', 'LEAVE_REQUEST', 'LOAN', 'NONE'],
        default: 'NONE',
      },
      recordId: {
        type: Schema.Types.ObjectId,
        default: null,
      },
      summary: {
        type: String,
        default: '',
      },
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

helpdeskTicketSchema.index({ companyId: 1, status: 1, category: 1, createdAt: -1 });

export const HelpdeskTicket = mongoose.model('HelpdeskTicket', helpdeskTicketSchema);