import { AttendanceRecord } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { Company } from '../models/company.model.js';
import {
  calculateCheckInMetrics,
  calculateCheckOutMetrics,
} from '../utils/attendance.helper.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Helper to resolve Employee for current user/request
 */
const resolveEmployee = async (req, companyId) => {
  let employeeId = req.body.employeeId;

  if (req.user.role === 'EMPLOYEE') {
    const employee = await Employee.findOne({
      companyId,
      $or: [{ userId: req.user._id }, { email: req.user.email.toLowerCase() }],
    });
    if (!employee) {
      throw new ApiError(404, 'Employee profile not linked to your user account.');
    }
    return employee;
  }

  // For Admin / HR
  if (!employeeId) {
    throw new ApiError(400, 'employeeId is required for HR/Admin operations.');
  }

  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) {
    throw new ApiError(404, 'Employee not found in your company.');
  }
  return employee;
};

/**
 * @desc    Manual Employee Check-In
 * @route   POST /api/v1/attendance/check-in
 */
export const checkIn = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const company = await Company.findById(companyId);
  const timezone = company?.timezone || 'Asia/Karachi';

  const employee = await resolveEmployee(req, companyId);
  const checkInTime = req.body.checkInTime ? new Date(req.body.checkInTime) : new Date();

  // Compute date and lateness in Company Timezone
  const { dateStr, lateMinutes, status } = calculateCheckInMetrics({
    checkInDateObj: checkInTime,
    timezone,
    shiftStart: '09:00',
    graceMinutes: 15,
  });

  // Check for duplicate check-in on the same calendar day
  const existingRecord = await AttendanceRecord.findOne({
    companyId,
    employeeId: employee._id,
    date: dateStr,
  });

  if (existingRecord) {
    throw new ApiError(
      409,
      `Already checked in for today (${dateStr}) at ${existingRecord.checkInTime.toISOString()}. Duplicate check-in rejected.`
    );
  }

  const attendance = await AttendanceRecord.create({
    companyId,
    employeeId: employee._id,
    date: dateStr,
    checkInTime,
    checkInMethod: 'MANUAL',
    status,
    lateMinutes,
    notes: req.body.notes || '',
  });

  return res.status(201).json(
    new ApiResponse(201, attendance, 'Check-in recorded successfully.')
  );
});

/**
 * @desc    Manual Employee Check-Out
 * @route   POST /api/v1/attendance/check-out
 */
export const checkOut = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const company = await Company.findById(companyId);
  const timezone = company?.timezone || 'Asia/Karachi';

  const employee = await resolveEmployee(req, companyId);
  const checkOutTime = req.body.checkOutTime ? new Date(req.body.checkOutTime) : new Date();

  const { dateStr } = calculateCheckInMetrics({
    checkInDateObj: checkOutTime,
    timezone,
  });

  // Find today's open attendance record
  const attendance = await AttendanceRecord.findOne({
    companyId,
    employeeId: employee._id,
    date: dateStr,
  });

  if (!attendance) {
    throw new ApiError(
      400,
      `No check-in record found for today (${dateStr}). You must check in before checking out.`
    );
  }

  if (attendance.checkOutTime) {
    throw new ApiError(
      409,
      `Already checked out for today at ${attendance.checkOutTime.toISOString()}.`
    );
  }

  if (checkOutTime <= attendance.checkInTime) {
    throw new ApiError(400, 'Check-out time cannot be earlier than or equal to check-in time.');
  }

  // Calculate early leave, overtime, and total duration
  const metrics = calculateCheckOutMetrics({
    checkInDateObj: attendance.checkInTime,
    checkOutDateObj: checkOutTime,
    timezone,
    shiftEnd: '17:00',
    standardShiftMinutes: 480,
  });

  attendance.checkOutTime = checkOutTime;
  attendance.checkOutMethod = 'MANUAL';
  attendance.totalWorkingMinutes = metrics.totalWorkingMinutes;
  attendance.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
  attendance.overtimeMinutes = metrics.overtimeMinutes;

  if (req.body.notes) {
    attendance.notes = attendance.notes ? `${attendance.notes} | ${req.body.notes}` : req.body.notes;
  }

  await attendance.save();

  return res.status(200).json(
    new ApiResponse(200, attendance, 'Check-out recorded successfully.')
  );
});

/**
 * @desc    Get Attendance Records for Employee / HR Review
 * @route   GET /api/v1/attendance
 */
export const getAttendanceRecords = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { employeeId, date, requiresReview, month } = req.query;

  const filter = { companyId };

  if (req.user.role === 'EMPLOYEE') {
    const employee = await Employee.findOne({
      companyId,
      $or: [{ userId: req.user._id }, { email: req.user.email.toLowerCase() }],
    });
    filter.employeeId = employee?._id;
  } else if (employeeId) {
    filter.employeeId = employeeId;
  }

  if (date) filter.date = date;
  if (requiresReview !== undefined) filter.requiresReview = requiresReview === 'true';
  if (month) filter.date = { $regex: `^${month}` }; // Format: YYYY-MM

  const records = await AttendanceRecord.find(filter)
    .populate('employeeId', 'firstName lastName employeeId department designation')
    .sort({ date: -1, checkInTime: -1 });

  return res.status(200).json(
    new ApiResponse(200, records, 'Attendance records retrieved successfully.')
  );
});

/**
 * @desc    Review/Flag Missing Checkouts (For End-of-Day HR Review)
 * @route   POST /api/v1/attendance/flag-missing-checkouts
 */
export const flagMissingCheckouts = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const company = await Company.findById(companyId);
  const timezone = company?.timezone || 'Asia/Karachi';

  const { date } = req.body;
  const targetDate = date || DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat('yyyy-MM-dd');

  // Update records with missing checkouts
  const result = await AttendanceRecord.updateMany(
    {
      companyId,
      date: targetDate,
      checkOutTime: null,
      requiresReview: false,
    },
    {
      $set: {
        status: 'MISSING_CHECKOUT',
        requiresReview: true,
        reviewReason: 'Missing check-out at end of day.',
      },
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount, targetDate },
      `Flagged ${result.modifiedCount} records for HR review.`
    )
  );
});