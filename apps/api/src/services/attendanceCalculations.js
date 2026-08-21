import { DateTime } from 'luxon';

/**
 * Default fallback settings if company settings are not configured
 */
export const DEFAULT_ATTENDANCE_SETTINGS = {
  timezone: 'Asia/Karachi',
  shiftStart: '09:00',
  shiftEnd: '17:00',
  gracePeriodMinutes: 15,
  standardShiftMinutes: 480,
  halfDayThresholdMinutes: 240,
  overtimeMinimumMinutes: 0,
};

/**
 * Calculates check-in metrics against company shift and grace period settings.
 *
 * @param {Object} params
 * @param {Date|string} params.checkInTime - Check-in timestamp
 * @param {Object} [params.config] - Company attendance configuration
 * @returns {Object} { dateStr, lateMinutes, isLate, status }
 */
export const calculateCheckIn = ({ checkInTime, config = {} }) => {
  if (!checkInTime) {
    return {
      dateStr: null,
      lateMinutes: 0,
      isLate: false,
      status: 'ABSENT',
    };
  }

  const timezone = config.timezone || DEFAULT_ATTENDANCE_SETTINGS.timezone;
  const shiftStart = config.shiftStart || DEFAULT_ATTENDANCE_SETTINGS.shiftStart;
  const gracePeriodMinutes =
    config.gracePeriodMinutes !== undefined
      ? Number(config.gracePeriodMinutes)
      : DEFAULT_ATTENDANCE_SETTINGS.gracePeriodMinutes;

  const checkInZoned = (
    checkInTime instanceof Date
      ? DateTime.fromJSDate(checkInTime)
      : DateTime.fromISO(checkInTime)
  ).setZone(timezone);

  const dateStr = checkInZoned.toFormat('yyyy-MM-dd');
  const [startHour, startMin] = shiftStart.split(':').map(Number);

  const shiftStartDateTime = checkInZoned.set({
    hour: startHour,
    minute: startMin,
    second: 0,
    millisecond: 0,
  });

  // Grace Period boundary calculation
  const graceThreshold = shiftStartDateTime.plus({ minutes: gracePeriodMinutes });

  let lateMinutes = 0;
  let isLate = false;
  let status = 'PRESENT';

  // Boundary Rule: checkIn <= graceThreshold is ON TIME. checkIn > graceThreshold is LATE.
  if (checkInZoned > graceThreshold) {
    const diff = checkInZoned.diff(shiftStartDateTime, 'minutes').toObject();
    lateMinutes = Math.max(0, Math.round(diff.minutes));
    isLate = true;
    status = 'LATE';
  }

  return {
    dateStr,
    lateMinutes,
    isLate,
    status,
  };
};

/**
 * Calculates complete attendance metrics including worked duration, early departure, and overtime.
 *
 * @param {Object} params
 * @param {Date|string|null} params.checkInTime
 * @param {Date|string|null} params.checkOutTime
 * @param {Object} [params.config] - Company attendance configuration
 * @returns {Object} Complete calculated metrics
 */
export const calculateAttendanceRecord = ({ checkInTime, checkOutTime, config = {} }) => {
  const timezone = config.timezone || DEFAULT_ATTENDANCE_SETTINGS.timezone;
  const shiftStart = config.shiftStart || DEFAULT_ATTENDANCE_SETTINGS.shiftStart;
  const shiftEnd = config.shiftEnd || DEFAULT_ATTENDANCE_SETTINGS.shiftEnd;
  const gracePeriodMinutes =
    config.gracePeriodMinutes !== undefined
      ? Number(config.gracePeriodMinutes)
      : DEFAULT_ATTENDANCE_SETTINGS.gracePeriodMinutes;
  const standardShiftMinutes =
    config.standardShiftMinutes !== undefined
      ? Number(config.standardShiftMinutes)
      : DEFAULT_ATTENDANCE_SETTINGS.standardShiftMinutes;
  const halfDayThresholdMinutes =
    config.halfDayThresholdMinutes !== undefined
      ? Number(config.halfDayThresholdMinutes)
      : DEFAULT_ATTENDANCE_SETTINGS.halfDayThresholdMinutes;
  const overtimeMinimumMinutes =
    config.overtimeMinimumMinutes !== undefined
      ? Number(config.overtimeMinimumMinutes)
      : DEFAULT_ATTENDANCE_SETTINGS.overtimeMinimumMinutes;

  // Case 1: Absence (No check-in at all)
  if (!checkInTime) {
    return {
      status: 'ABSENT',
      totalWorkingMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      payableHoursRatio: 0,
      isAbsent: true,
      requiresReview: false,
    };
  }

  const checkInRes = calculateCheckIn({ checkInTime, config });

  // Case 2: Open record (Check-in exists, but not checked out yet)
  if (!checkOutTime) {
    return {
      dateStr: checkInRes.dateStr,
      status: checkInRes.status,
      totalWorkingMinutes: 0,
      lateMinutes: checkInRes.lateMinutes,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      payableHoursRatio: 0,
      isAbsent: false,
      requiresReview: false,
    };
  }

  const checkInZoned = (
    checkInTime instanceof Date
      ? DateTime.fromJSDate(checkInTime)
      : DateTime.fromISO(checkInTime)
  ).setZone(timezone);

  const checkOutZoned = (
    checkOutTime instanceof Date
      ? DateTime.fromJSDate(checkOutTime)
      : DateTime.fromISO(checkOutTime)
  ).setZone(timezone);

  const [endHour, endMin] = shiftEnd.split(':').map(Number);
  const shiftEndDateTime = checkOutZoned.set({
    hour: endHour,
    minute: endMin,
    second: 0,
    millisecond: 0,
  });

  // Calculate total duration worked
  const totalWorkingMinutes = Math.max(
    0,
    Math.round(checkOutZoned.diff(checkInZoned, 'minutes').minutes)
  );

  // Early leave calculation
  let earlyLeaveMinutes = 0;
  if (checkOutZoned < shiftEndDateTime) {
    const earlyDiff = shiftEndDateTime.diff(checkOutZoned, 'minutes').toObject();
    earlyLeaveMinutes = Math.max(0, Math.round(earlyDiff.minutes));
  }

  // Overtime calculation
  let overtimeMinutes = 0;
  if (totalWorkingMinutes > standardShiftMinutes) {
    const rawOvertime = totalWorkingMinutes - standardShiftMinutes;
    if (rawOvertime >= overtimeMinimumMinutes) {
      overtimeMinutes = rawOvertime;
    }
  }

  // Final Status evaluation (Half Day / Late / Present)
  let status = checkInRes.status;
  if (totalWorkingMinutes < halfDayThresholdMinutes) {
    status = 'HALF_DAY';
  }

  const payableHoursRatio = Number(
    Math.min(1, totalWorkingMinutes / standardShiftMinutes).toFixed(2)
  );

  return {
    dateStr: checkInRes.dateStr,
    status,
    totalWorkingMinutes,
    lateMinutes: checkInRes.lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    payableHoursRatio,
    isAbsent: false,
    requiresReview: false,
  };
};