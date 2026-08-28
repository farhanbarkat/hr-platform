import mongoose, { Schema } from 'mongoose';

const notificationSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['INFO', 'WARNING', 'ALERT', 'SUCCESS'],
      default: 'INFO',
    },
    category: {
      type: String,
      enum: ['SYSTEM', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'ANNOUNCEMENT', 'TASK'],
      default: 'SYSTEM',
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    channels: {
      type: [String],
      enum: ['IN_APP', 'EMAIL', 'PUSH', 'SMS'],
      default: ['IN_APP'],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    emailDeliveryStatus: {
      type: String,
      enum: ['NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED'],
      default: 'NOT_REQUESTED',
    },
  },
  { timestamps: true }
);

// Performance index for notification bell and unread counts
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);