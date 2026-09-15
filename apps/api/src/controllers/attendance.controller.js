import mongoose from 'mongoose';
import { NotificationService } from '../services/notification.service.js';
import { AttendanceRecord } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { Company } from '../models/company.model.js';
import {
  calculateCheckIn,
  calculateAttendanceRecord,
} from '../services/attendanceCalculations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateGeofence } from '../utils/geo.helper.js';

/**
 * Helper to resolve Employee for current user/request
 * Supports both self-punch (Employee, HR, Manager) and Admin proxy punch
 */
const resolveEmployee = async (req, companyId) => {
  let employeeId = req.body.employeeId;

  // 1. Agar request body mein explicit employeeId di gayi hai (HR kisi aur ki punch kar raha hai)
  if (employeeId) {
    const employee = await Employee.findOne({ _id: employeeId, companyId });
    if (!employee) {
      throw new ApiError(404, 'Employee not found in your company.');
    }
    return employee;
  }

  // 2. Self-Punch (Chahe user ka role EMPLOYEE ho, HR ho, MANAGER ho ya ADMIN):
  // User ke linked Employee record ko find karein
  const employee = await Employee.findOne({
    companyId,
    $or: [
      { userId: req.user._id },
      { email: req.user.email ? req.user.email.toLowerCase() : '' }
    ],
  });

  if (!employee) {
    throw new ApiError(
      404,
      `Your account (${req.user.email}) is not linked to an active Employee profile in this company.`
    );
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
  const attendanceConfig = {
    timezone: company?.timezone || 'Asia/Karachi',
    ...(company?.settings?.attendance || {}),
  };

  const employee = await resolveEmployee(req, companyId);
  const checkInTime = req.body.checkInTime ? new Date(req.body.checkInTime) : new Date();
  const checkInMethod = req.body.checkInMethod || (req.body.lat !== undefined ? 'GPS' : 'MANUAL');

  let locationData = { latitude: null, longitude: null, distanceMeters: null };

  if (checkInMethod === 'GPS' || req.body.lat !== undefined) {
    const geoValidation = validateGeofence(req.body.lat, req.body.lng, company);
    if (!geoValidation.isValid) {
      throw new ApiError(403, `Geofence Validation Failed: ${geoValidation.reason}`);
    }
    locationData = {
      latitude: Number(req.body.lat),
      longitude: Number(req.body.lng),
      distanceMeters: geoValidation.distanceMeters,
    };
  }

  // 🚀 Use Shared Calculation Service
  const { dateStr, lateMinutes, status } = calculateCheckIn({
    checkInTime,
    config: attendanceConfig,
  });

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
    checkInMethod,
    checkInLocation: locationData,
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
  const attendanceConfig = {
    timezone: company?.timezone || 'Asia/Karachi',
    ...(company?.settings?.attendance || {}),
  };

  const employee = await resolveEmployee(req, companyId);
  const checkOutTime = req.body.checkOutTime ? new Date(req.body.checkOutTime) : new Date();
  const checkOutMethod = req.body.checkOutMethod || (req.body.lat !== undefined ? 'GPS' : 'MANUAL');

  let locationData = { latitude: null, longitude: null, distanceMeters: null };

  if (checkOutMethod === 'GPS' || req.body.lat !== undefined) {
    const geoValidation = validateGeofence(req.body.lat, req.body.lng, company);
    if (!geoValidation.isValid) {
      throw new ApiError(403, `Geofence Validation Failed: ${geoValidation.reason}`);
    }
    locationData = {
      latitude: Number(req.body.lat),
      longitude: Number(req.body.lng),
      distanceMeters: geoValidation.distanceMeters,
    };
  }

  const { dateStr } = calculateCheckIn({
    checkInTime: checkOutTime,
    config: attendanceConfig,
  });

  const attendance = await AttendanceRecord.findOne({
    companyId,
    employeeId: employee._id,
    date: dateStr,
  });

  if (!attendance) {
    throw new ApiError(400, `No check-in record found for today (${dateStr}).`);
  }

  if (attendance.checkOutTime) {
    throw new ApiError(409, `Already checked out for today at ${attendance.checkOutTime.toISOString()}.`);
  }

  if (checkOutTime <= attendance.checkInTime) {
    throw new ApiError(400, 'Check-out time cannot be earlier than check-in time.');
  }

  // 🚀 Use Shared Calculation Service
  const metrics = calculateAttendanceRecord({
    checkInTime: attendance.checkInTime,
    checkOutTime,
    config: attendanceConfig,
  });

  attendance.checkOutTime = checkOutTime;
  attendance.checkOutMethod = checkOutMethod;
  attendance.checkOutLocation = locationData;
  attendance.totalWorkingMinutes = metrics.totalWorkingMinutes;
  attendance.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
  attendance.overtimeMinutes = metrics.overtimeMinutes;
  attendance.status = metrics.status;

  await attendance.save();

  // 🚀 TICKET-017: Real-time Early Checkout Alert to Direct Manager
  if (attendance.earlyLeaveMinutes > 0) {
    await NotificationService.checkAndTriggerEarlyCheckoutAlert({
      companyId: attendance.companyId,
      employeeId: attendance.employeeId,
      earlyLeaveMinutes: attendance.earlyLeaveMinutes,
      checkOutTime: attendance.checkOutTime,
    });
  }

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

  if (!companyId) {
    throw new ApiError(400, 'Company context is missing.');
  }

  const { employeeId, date, requiresReview, month } = req.query;

  // Company ID matching (handles both ObjectId & string format)
  const isObjectId = mongoose.Types.ObjectId.isValid(companyId);
  const filter = {
    companyId: isObjectId
      ? { $in: [companyId, new mongoose.Types.ObjectId(companyId)] }
      : companyId,
  };

  if (req.user?.role === 'EMPLOYEE') {
    const employee = await Employee.findOne({
      companyId: filter.companyId,
      $or: [{ userId: req.user._id }, { email: req.user.email?.toLowerCase() }],
    });
    filter.employeeId = employee?._id;
  } else if (employeeId) {
    filter.employeeId = employeeId;
  }

  if (date) filter.date = date;
  if (requiresReview !== undefined) filter.requiresReview = requiresReview === 'true';
  if (month) filter.date = { $regex: `^${month}` };

  // strictPopulate: false crash hone se rokta hai
  const records = await AttendanceRecord.find(filter)
    .populate({
      path: 'employeeId',
      select: 'firstName lastName employeeId department designation email',
      strictPopulate: false,
    })
    .sort({ createdAt: -1, checkInTime: -1 });

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