import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['HOLIDAY', 'MEETING', 'TRAINING', 'DEADLINE', 'OTHER'],
      default: 'OTHER',
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    isAllDay: {
      type: Boolean,
      default: false,
    },
   teamId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ['INTERNAL', 'SYNCED'],
      default: 'INTERNAL',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for rapid date range + team filtering
calendarEventSchema.index({ companyId: 1, startDate: 1, endDate: 1 });
calendarEventSchema.index({ companyId: 1, teamId: 1, startDate: 1 });

export const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);