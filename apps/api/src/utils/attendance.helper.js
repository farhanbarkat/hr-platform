import { DateTime } from 'luxon';

/**
 * Calculates check-in metrics (late minutes, status) in company timezone
 */
export const calculateCheckInMetrics = ({
  checkInDateObj,
  timezone = 'Asia/Karachi',
  shiftStart = '09:00',
  graceMinutes = 15,
}) => {
  const checkInZoned = DateTime.fromJSDate(checkInDateObj).setZone(timezone);
  const formattedDate = checkInZoned.toFormat('yyyy-MM-dd');

  // Construct shift start DateTime for the check-in day
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const shiftStartDateTime = checkInZoned.set({
    hour: startHour,
    minute: startMin,
    second: 0,
    millisecond: 0,
  });

  const graceThreshold = shiftStartDateTime.plus({ minutes: graceMinutes });

  let lateMinutes = 0;
  let status = 'PRESENT';

  if (checkInZoned > graceThreshold) {
    const diff = checkInZoned.diff(shiftStartDateTime, 'minutes').toObject();
    lateMinutes = Math.max(0, Math.round(diff.minutes));
    status = 'LATE';
  }

  return {
    dateStr: formattedDate,
    lateMinutes,
    status,
  };
};

/**
 * Calculates check-out metrics (early leave, overtime, total minutes) in company timezone
 */
export const calculateCheckOutMetrics = ({
  checkInDateObj,
  checkOutDateObj,
  timezone = 'Asia/Karachi',
  shiftEnd = '17:00',
  standardShiftMinutes = 480, // 8 Hours
}) => {
  const checkInZoned = DateTime.fromJSDate(checkInDateObj).setZone(timezone);
  const checkOutZoned = DateTime.fromJSDate(checkOutDateObj).setZone(timezone);

  const [endHour, endMin] = shiftEnd.split(':').map(Number);
  const shiftEndDateTime = checkOutZoned.set({
    hour: endHour,
    minute: endMin,
    second: 0,
    millisecond: 0,
  });

  // Total worked minutes
  const totalWorked = Math.max(
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
  if (totalWorked > standardShiftMinutes) {
    overtimeMinutes = totalWorked - standardShiftMinutes;
  }

  return {
    totalWorkingMinutes: totalWorked,
    earlyLeaveMinutes,
    overtimeMinutes,
  };
};