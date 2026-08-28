import mongoose, { Schema } from 'mongoose';

const taskAttachmentSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    s3Key: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER'],
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

taskAttachmentSchema.index({ companyId: 1, taskId: 1 });

export const TaskAttachment = mongoose.model('TaskAttachment', taskAttachmentSchema);