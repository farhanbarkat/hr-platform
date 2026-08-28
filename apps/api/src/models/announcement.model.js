import mongoose, { Schema } from 'mongoose';

const announcementSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required.'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters.'],
    },
    body: {
      type: String,
      required: [true, 'Announcement body is required.'],
      trim: true,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ['all', 'department', 'team'],
      default: 'all',
      required: true,
      index: true,
    },
    targetDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    targetTeamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent', 'critical'],
      default: 'normal',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for audience retrieval performance
announcementSchema.index({ companyId: 1, targetAudience: 1, isActive: 1, createdAt: -1 });

export const Announcement = mongoose.model('Announcement', announcementSchema);