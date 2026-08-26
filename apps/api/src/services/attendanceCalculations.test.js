import {
  calculateCheckIn,
  calculateAttendanceRecord,
} from './attendanceCalculations.js';

describe('TICKET-011: Attendance & Overtime Calculation Service', () => {
  const companyConfig = {
    timezone: 'Asia/Karachi',
    shiftStart: '09:00',
    shiftEnd: '17:00',
    gracePeriodMinutes: 15,
    standardShiftMinutes: 480, // 8 hrs
    halfDayThresholdMinutes: 240, // 4 hrs
    overtimeMinimumMinutes: 0,
  };

  // -------------------------------------------------------------
  // Test Case 1: Check-in EXACTLY at grace period boundary (09:15)
  // -------------------------------------------------------------
  it('should mark as PRESENT and 0 late minutes when arriving exactly on the grace period boundary (09:15)', () => {
    const checkInTime = '2026-08-21T09:15:00.000+05:00';
    const result = calculateCheckIn({ checkInTime, config: companyConfig });

    expect(result.status).toBe('PRESENT');
    expect(result.isLate).toBe(false);
    expect(result.lateMinutes).toBe(0);
    expect(result.dateStr).toBe('2026-08-21');
  });

  // -------------------------------------------------------------
  // Test Case 2: Check-in 1 MINUTE past grace period (09:16)
  // -------------------------------------------------------------
  it('should mark as LATE with 16 late minutes when arriving 1 minute past grace period (09:16)', () => {
    const checkInTime = '2026-08-21T09:16:00.000+05:00';
    const result = calculateCheckIn({ checkInTime, config: companyConfig });

    expect(result.status).toBe('LATE');
    expect(result.isLate).toBe(true);
    expect(result.lateMinutes).toBe(16); // Measured from shift start (09:00 to 09:16)
  });

  // -------------------------------------------------------------
  // Test Case 3: Full-Day Absence (No check-in record)
  // -------------------------------------------------------------
  it('should return ABSENT status and 0 working minutes for full-day absence with no check-in', () => {
    const result = calculateAttendanceRecord({
      checkInTime: null,
      checkOutTime: null,
      config: companyConfig,
    });

    expect(result.status).toBe('ABSENT');
    expect(result.isAbsent).toBe(true);
    expect(result.totalWorkingMinutes).toBe(0);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.payableHoursRatio).toBe(0);
  });

  // -------------------------------------------------------------
  // Test Case 4: Early Leave Calculation (Leaving at 16:00 vs 17:00)
  // -------------------------------------------------------------
  it('should compute early leave minutes correctly when leaving before shift end', () => {
    const checkInTime = '2026-08-21T09:00:00.000+05:00';
    const checkOutTime = '2026-08-21T16:00:00.000+05:00'; // 1 hr early

    const result = calculateAttendanceRecord({
      checkInTime,
      checkOutTime,
      config: companyConfig,
    });

    expect(result.totalWorkingMinutes).toBe(420); // 7 hrs
    expect(result.earlyLeaveMinutes).toBe(60); // 17:00 - 16:00 = 60 mins
    expect(result.overtimeMinutes).toBe(0);
    expect(result.status).toBe('PRESENT');
  });

  // -------------------------------------------------------------
  // Test Case 5: Overtime Calculation (Working 10 Hours vs 8 Hours)
  // -------------------------------------------------------------
  it('should compute overtime minutes correctly when working past standard shift duration', () => {
    const checkInTime = '2026-08-21T09:00:00.000+05:00';
    const checkOutTime = '2026-08-21T19:00:00.000+05:00'; // 10 hrs

    const result = calculateAttendanceRecord({
      checkInTime,
      checkOutTime,
      config: companyConfig,
    });

    expect(result.totalWorkingMinutes).toBe(600); // 10 hrs
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(120); // 600 - 480 = 120 mins
  });

  // -------------------------------------------------------------
  // Test Case 6: Custom Company Config Grace Period Override
  // -------------------------------------------------------------
  it('should respect custom company grace period config (e.g. 30 minutes grace)', () => {
    const customConfig = { ...companyConfig, gracePeriodMinutes: 30 };
    const checkInTime = '2026-08-21T09:25:00.000+05:00'; // Inside 30 min grace

    const result = calculateCheckIn({ checkInTime, config: customConfig });

    expect(result.status).toBe('PRESENT');
    expect(result.isLate).toBe(false);
    expect(result.lateMinutes).toBe(0);
  });
});