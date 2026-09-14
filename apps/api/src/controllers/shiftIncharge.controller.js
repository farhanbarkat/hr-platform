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
const getTodayTimeDate = (timeStr = '09:00', baseDate = new Date()) => {
  const parts = String(timeStr).split(':');
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * 1. Get Real-Time Live Shift Monitoring Dashboard for Incharge
 * GET /api/v1/shift-incharge/dashboard
 */
export const getInchargeShiftDashboard = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const role = req.user?.role?.toUpperCase();
  const isAdminOrHr = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'HR_MANAGER'].includes(role);

  // 1. Base Boundary Query for Active Assignments
  const assignmentQuery = {
    companyId,
    startDate: { $lte: endOfToday },
    $or: [{ endDate: null }, { endDate: { $gte: today } }],
  };

  // 2. Role-based scoping
  if (isAdminOrHr) {
    if (req.query.inchargeId && req.query.inchargeId !== 'ALL') {
      assignmentQuery.inchargeId = req.query.inchargeId;
    }
  } else {
    const employee = await Employee.findOne({
      $or: [{ userId: req.user._id }, { email: req.user.email }],
      companyId,
    });

    if (!employee) {
      throw new ApiError(404, 'Employee record not found for logged-in user.');
    }

    assignmentQuery.inchargeId = employee._id;
  }

  // 3. Find shift assignments
  const assignments = await ShiftAssignment.find(assignmentQuery)
    .populate('shiftTemplateId', 'name startTime endTime gracePeriodOverride isNightShift')
    .populate('employeeId', 'firstName lastName email designation departmentId employeeCode avatar')
    .lean();

  if (!assignments.length) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          shiftSummary: {
            totalAssigned: 0,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            onLeaveCount: 0,
          },
          roster: [],
        },
        'No active employees found under shift supervision for today.'
      )
    );
  }

  const assignedEmployeeIds = assignments.map((a) => a.employeeId?._id).filter(Boolean);

  // 4. Lookups for Attendance & Approved Leaves
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

  const attendanceMap = new Map(
    attendanceLogs.map((log) => [log.employeeId.toString(), log])
  );
  const leaveMap = new Map(
    activeLeaves.map((l) => [l.employeeId.toString(), l])
  );

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let onLeaveCount = 0;

  const now = new Date();

  // 5. Build dynamic status for each employee
  const roster = assignments.map((item) => {
    const emp = item.employeeId;
    const shift = item.shiftTemplateId;
    const empIdStr = emp?._id?.toString();

    const attendanceRecord = attendanceMap.get(empIdStr);
    const leaveRecord = leaveMap.get(empIdStr);

    let status = 'NOT_CHECKED_IN';
    let checkInTime = attendanceRecord?.clockIn || attendanceRecord?.checkInTime || null;
    let checkOutTime = attendanceRecord?.clockOut || attendanceRecord?.checkOutTime || null;

    if (leaveRecord) {
      status = 'ON_LEAVE';
      onLeaveCount++;
    } else if (attendanceRecord?.status === 'PRESENT' || checkInTime) {
      const shiftStartTime = getTodayTimeDate(shift?.startTime || '09:00', today);
      const graceMinutes = shift?.gracePeriodOverride ?? 15;
      const lateThreshold = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

      const actualCheckIn = new Date(checkInTime);

      if (actualCheckIn > lateThreshold || attendanceRecord?.status === 'LATE' || attendanceRecord?.isLate) {
        status = 'LATE';
        lateCount++;
        presentCount++;
      } else {
        status = 'CHECKED_IN';
        presentCount++;
      }
    } else {
      const shiftStartTime = getTodayTimeDate(shift?.startTime || '09:00', today);
      const graceMinutes = shift?.gracePeriodOverride ?? 15;
      const lateThreshold = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

      if (now > lateThreshold) {
        status = 'ABSENT';
        absentCount++;
      } else {
        status = 'EXPECTED';
      }
    }

    return {
      assignmentId: item._id,
      employee: {
        _id: emp?._id,
        name: `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || 'Worker',
        employeeCode: emp?.employeeCode || emp?.employeeId || 'EMP',
        designation: emp?.designation || 'Staff',
        email: emp?.email,
      },
      shift: {
        _id: shift?._id,
        name: shift?.name || 'General Shift',
        startTime: shift?.startTime || '09:00',
        endTime: shift?.endTime || '18:00',
        gracePeriod: shift?.gracePeriodOverride ?? 15,
      },
      attendance: {
        status,
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