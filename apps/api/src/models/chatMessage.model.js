import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: [true, 'Message body is required'],
      trim: true,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying conversation history between two specific users inside a tenant
chatMessageSchema.index({ companyId: 1, senderId: 1, recipientId: 1, createdAt: -1 });
chatMessageSchema.index({ companyId: 1, recipientId: 1, readAt: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);