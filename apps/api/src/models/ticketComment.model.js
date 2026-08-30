import mongoose, { Schema } from 'mongoose';

const ticketCommentSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'HelpdeskTicket',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
    },
    isInternalNote: {
      type: Boolean,
      default: false, // Internal HR-only comments
    },
  },
  { timestamps: true }
);

ticketCommentSchema.index({ companyId: 1, ticketId: 1, createdAt: 1 });

export const TicketComment = mongoose.model('TicketComment', ticketCommentSchema);