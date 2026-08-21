import mongoose, { Schema } from 'mongoose';

const attendanceRecordSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },

    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    date: {
      type: String,
      // Format: YYYY-MM-DD (Normalized in Company Timezone)
      required: true,
    },

    checkInTime: {
      type: Date,
      required: true,
    },

    checkOutTime: {
      type: Date,
      default: null,
    },

    checkInMethod: {
      type: String,
      enum: ['MANUAL', 'GPS', 'BIOMETRIC'],
      default: 'MANUAL',
    },

    checkOutMethod: {
      type: String,
      enum: ['MANUAL', 'GPS', 'BIOMETRIC'],
      default: null,
    },

    // 📍 Check-in GPS Location
    checkInLocation: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      distanceMeters: {
        type: Number,
        default: null,
      },
    },

    // 📍 Check-out GPS Location
    checkOutLocation: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      distanceMeters: {
        type: Number,
        default: null,
      },
    },

    status: {
      type: String,
      enum: [
        'PRESENT',
        'LATE',
        'HALF_DAY',
        'ABSENT',
        'ON_LEAVE',
        'MISSING_CHECKOUT',
      ],
      default: 'PRESENT',
    },

    lateMinutes: {
      type: Number,
      default: 0,
    },

    earlyLeaveMinutes: {
      type: Number,
      default: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
    },

    totalWorkingMinutes: {
      type: Number,
      default: 0,
    },

    requiresReview: {
      type: Boolean,
      default: false,
      index: true,
    },

    reviewReason: {
      type: String,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// One attendance record per employee per calendar date
attendanceRecordSchema.index(
  {
    companyId: 1,
    employeeId: 1,
    date: 1,
  },
  {
    unique: true,
  }
);

export const AttendanceRecord = mongoose.model(
  'AttendanceRecord',
  attendanceRecordSchema
);