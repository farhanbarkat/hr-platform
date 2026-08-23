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

      attendance: {
        shiftStart: {
          type: String,
          default: '09:00', // HH:mm format
        },

        shiftEnd: {
          type: String,
          default: '17:00', // HH:mm format
        },

        gracePeriodMinutes: {
          type: Number,
          default: 15,
        },

        standardShiftMinutes: {
          type: Number,
          default: 480, // 8 hours
        },

        halfDayThresholdMinutes: {
          type: Number,
          default: 240, // 4 hours minimum for half-day
        },

        overtimeMinimumMinutes: {
          type: Number,
          default: 30, // Minimum overtime to count
        },

        // --- NAYE FIELDS FOR TICKET-017 (CONFIGURABLE DEDUCTION SETTINGS) ---
        deductionCalculationMode: {
          type: String,
          enum: ['DYNAMIC_HOURLY', 'FIXED_RATE'],
          default: 'DYNAMIC_HOURLY', // DYNAMIC: Base Salary ke hisab se hourly cut, FIXED: Niche diye rate ke hisab se
        },

        fixedDeductionRatePerHour: {
          type: mongoose.Schema.Types.Decimal128,
          default: mongoose.Types.Decimal128.fromString('0.00'),
        },

        earlyCheckoutAlertThresholdMinutes: {
          type: Number,
          default: 30, // Alert manager if checkout occurs >= 30 mins before shiftEnd
        },
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