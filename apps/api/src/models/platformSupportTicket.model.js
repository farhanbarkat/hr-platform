import mongoose, { Schema } from 'mongoose';

const platformSupportTicketSchema = new Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required.'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
    },
    category: {
      type: String,
      enum: ['BILLING', 'TECHNICAL', 'FEATURE_REQUEST', 'ACCOUNT', 'OTHER'],
      default: 'TECHNICAL',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const PlatformSupportTicket = mongoose.model(
  'PlatformSupportTicket',
  platformSupportTicketSchema
);