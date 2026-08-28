import { ShiftAssignment } from '../models/shiftAssignment.model.js';
import { AttendanceRecord } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Helper: Parse "HH:mm" time string into a Date object for today
 */
const getTodayTimeDate = (timeStr, baseDate = new Date()) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * 1. Get Real-Time Live Shift Monitoring Dashboard for Incharge
 * GET /api/v1/shift-incharge/dashboard
 */
export const getInchargeShiftDashboard = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  // 1. Resolve logged-in incharge employee record
  let inchargeEmployeeId = req.query.inchargeId;

  if (!inchargeEmployeeId) {
    const employee = await Employee.findOne({
      $or: [{ userId: req.user._id }, { email: req.user.email }],
      companyId,
    });

    if (!employee && !['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR'].includes(req.user.role)) {
      throw new ApiError(404, 'Employee record not found for logged in user.');
    }

    inchargeEmployeeId = employee?._id;
  }

  // 2. Build Query: Admin/HR can pass ?inchargeId or view all, Incharge is strictly scoped to themselves
  const assignmentQuery = {
    companyId,
    startDate: { $lte: endOfToday },
    $or: [{ endDate: null }, { endDate: { $gte: today } }],
  };

  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR'].includes(req.user.role) || inchargeEmployeeId) {
    if (!inchargeEmployeeId) {
      throw new ApiError(403, 'You are not assigned as an incharge for any active shifts.');
    }
    assignmentQuery.inchargeId = inchargeEmployeeId;
  }

  // 3. Find active shift assignments monitored by this incharge
  const assignments = await ShiftAssignment.find(assignmentQuery)
    .populate('shiftTemplateId', 'name startTime endTime gracePeriodOverride isOvernight')
    .populate('employeeId', 'firstName lastName email designation departmentId employeeCode avatar')
    .lean();

  if (!assignments.length) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalAssigned: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          onLeaveCount: 0,
          roster: [],
        },
        'No active employees found under your shift supervision for today.'
      )
    );
  }

  const assignedEmployeeIds = assignments.map((a) => a.employeeId?._id).filter(Boolean);

  // 4. Parallel lookup: Today's Attendance logs and Approved Leaves
  const [attendanceLogs, activeLeaves] = await Promise.all([
    AttendanceRecord.find({
      companyId,
      employeeId: { $in: assignedEmployeeIds },
      date: { $gte: today, $lte: endOfToday },
    }).lean(),

    LeaveRequest.find({
      companyId,
      employeeId: { $in: assignedEmployeeIds },
      status: 'APPROVED',
      startDate: { $lte: endOfToday },
      endDate: { $gte: today },
    }).lean(),
  ]);

  const attendanceMap = new Map(attendanceLogs.map((log) => [log.employeeId.toString(), log]));
  const leaveMap = new Map(activeLeaves.map((l) => [l.employeeId.toString(), l]));

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let onLeaveCount = 0;

  const now = new Date();

  // 5. Build dynamic real-time status for each rostered employee
  const roster = assignments.map((item) => {
    const emp = item.employeeId;
    const shift = item.shiftTemplateId;
    const empIdStr = emp?._id?.toString();

    const attendanceRecord = attendanceMap.get(empIdStr);
    const leaveRecord = leaveMap.get(empIdStr);

    let status = 'NOT_CHECKED_IN';
    let statusColor = 'gray'; // semantic color mapping
    let checkInTime = attendanceRecord?.checkInTime || null;
    let checkOutTime = attendanceRecord?.checkOutTime || null;

    if (leaveRecord) {
      status = 'ON_LEAVE';
      statusColor = 'purple';
      onLeaveCount++;
    } else if (attendanceRecord?.status === 'PRESENT' || checkInTime) {
      // Calculate whether check-in was late based on shift template
      const shiftStartTime = getTodayTimeDate(shift.startTime, today);
      const graceMinutes = shift.gracePeriodOverride ?? 15;
      const lateThreshold = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

      const actualCheckIn = new Date(checkInTime);

      if (actualCheckIn > lateThreshold || attendanceRecord?.status === 'LATE') {
        status = 'LATE';
        statusColor = 'amber';
        lateCount++;
        presentCount++;
      } else {
        status = 'CHECKED_IN';
        statusColor = 'emerald';
        presentCount++;
      }
    } else {
      // Check if shift start time + grace has elapsed -> Mark visually ABSENT
      const shiftStartTime = getTodayTimeDate(shift.startTime, today);
      const graceMinutes = shift.gracePeriodOverride ?? 15;
      const lateThreshold = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

      if (now > lateThreshold) {
        status = 'ABSENT';
        statusColor = 'rose';
        absentCount++;
      } else {
        status = 'EXPECTED';
        statusColor = 'sky';
      }
    }

    return {
      assignmentId: item._id,
      employee: {
        _id: emp?._id,
        name: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim(),
        employeeCode: emp?.employeeCode,
        designation: emp?.designation,
        email: emp?.email,
      },
      shift: {
        _id: shift?._id,
        name: shift?.name,
        startTime: shift?.startTime,
        endTime: shift?.endTime,
        gracePeriod: shift?.gracePeriodOverride ?? 15,
      },
      attendance: {
        status,
        statusColor,
        checkInTime,
        checkOutTime,
        durationMinutes: attendanceRecord?.totalWorkMinutes || 0,
      },
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        shiftSummary: {
          totalAssigned: assignments.length,
          presentCount,
          lateCount,
          absentCount,
          onLeaveCount,
        },
        roster,
      },
      'Shift incharge monitoring dashboard data retrieved successfully.'
    )
  );
});