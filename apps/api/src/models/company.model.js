import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    currency: {
      type: String,
      required: true,
      default: 'PKR',
      uppercase: true,
    },

    defaultTimezone: {
      type: String,
      required: true,
      default: 'Asia/Karachi',
    },

    // Company Worksite / Geofence Settings
    worksiteLocation: {
      latitude: {
        type: Number,
        default: 31.5204,
      },
      longitude: {
        type: Number,
        default: 74.3587,
      },
      address: {
        type: String,
        default: 'Main Office HQ',
      },
    },

    allowedRadiusMeters: {
      type: Number,
      default: 150,
    },

    settings: {
      workingHours: {
        start: {
          type: String,
          default: '09:00',
        },
        end: {
          type: String,
          default: '18:00',
        },
      },

      gracePeriodMinutes: {
        type: Number,
        default: 15,
      },

      leavePolicyDefaults: {
        annualQuota: {
          type: Number,
          default: 14,
        },
        casualQuota: {
          type: Number,
          default: 10,
        },
        sickQuota: {
          type: Number,
          default: 8,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ _id: 1, slug: 1 });

export const Company = mongoose.model('Company', companySchema);