import mongoose, { Schema } from 'mongoose';

const taskTimeLogSchema = new Schema(
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
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null, // null indicates an active / running timer
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    isRunning: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

taskTimeLogSchema.index({ companyId: 1, employeeId: 1, isRunning: 1 });
taskTimeLogSchema.index({ companyId: 1, taskId: 1, startedAt: -1 });

export const TaskTimeLog = mongoose.model('TaskTimeLog', taskTimeLogSchema);