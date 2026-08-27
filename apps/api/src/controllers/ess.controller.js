import mongoose from 'mongoose';
import { Employee } from '../models/employee.model.js';
import { AttendanceRecord } from '../models/attendance.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { Payslip } from '../models/payslip.model.js';
import { Task } from '../models/task.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Aggregated ESS Dashboard Endpoint
 * Single round-trip for optimal performance on throttled/mobile connections
 * GET /api/v1/ess/dashboard
 */
export const getEssDashboard = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  // 1. Resolve employee securely from authenticated user identity
  const employee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  })
    .select('firstName lastName email employeeCode designation departmentId shiftId joiningDate')
    .populate('departmentId', 'name')
    .lean();

  if (!employee) {
    throw new ApiError(404, 'Employee record not found for the logged-in user.');
  }

  const employeeId = employee._id;

  // Calculate current month date bounds for attendance metrics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 2. Execute parallel server-side queries
  const [
    monthlyAttendance,
    leaveBalances,
    recentLeaves,
    recentPayslips,
    activeTasks,
  ] = await Promise.all([
    // A. Current Month Attendance Records
    AttendanceRecord.find({
      employeeId,
      companyId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .select('date status clockIn clockOut totalWorkHours isLate isHalfDay')
      .sort({ date: -1 })
      .lean(),

    // B. Leave Quota Balances
    LeaveBalance.find({
      employeeId,
      companyId,
      year: now.getFullYear(),
    })
      .select('leaveType totalAllocated used pending remaining')
      .lean(),

    // C. Recent Leave Requests (Last 5)
    LeaveRequest.find({
      employeeId,
      companyId,
    })
      .select('leaveType startDate endDate totalDays status reason createdAt rejectionReason')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    // D. Latest Available Payslips (Last 6 months)
    Payslip.find({
      employeeId,
      companyId,
      status: { $in: ['GENERATED', 'PUBLISHED', 'PAID'] },
    })
      .select('payPeriodMonth payPeriodYear netPay grossPay totalDeductions status generatedAt')
      .sort({ payPeriodYear: -1, payPeriodMonth: -1 })
      .limit(6)
      .lean(),

    // E. Assigned Active Tasks (TODO & IN_PROGRESS)
    Task.find({
      assignedTo: employeeId,
      companyId,
      status: { $in: ['TODO', 'IN_PROGRESS'] },
    })
      .select('title description priority deadline status createdAt')
      .sort({ deadline: 1 })
      .limit(10)
      .lean(),
  ]);

  // 3. Compute lightweight summary metrics
  const attendanceSummary = {
    totalLoggedDays: monthlyAttendance.length,
    presentDays: monthlyAttendance.filter((a) => a.status === 'PRESENT').length,
    absentDays: monthlyAttendance.filter((a) => a.status === 'ABSENT').length,
    lateDays: monthlyAttendance.filter((a) => a.isLate).length,
    halfDays: monthlyAttendance.filter((a) => a.isHalfDay).length,
    currentMonthRecords: monthlyAttendance.slice(0, 7), // Last 7 records for quick chart/feed
  };

  // Annotate overdue flags on tasks
  const tasksWithOverdue = activeTasks.map((t) => ({
    ...t,
    isOverdue: t.deadline && new Date() > new Date(t.deadline),
  }));

  // 4. Return compact aggregated response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        profile: {
          employeeId: employee._id,
          employeeCode: employee.employeeCode,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          designation: employee.designation,
          department: employee.departmentId?.name || 'Unassigned',
        },
        attendance: attendanceSummary,
        leaves: {
          balances: leaveBalances,
          recentRequests: recentLeaves,
        },
        payslips: recentPayslips,
        tasks: {
          activeCount: tasksWithOverdue.length,
          overdueCount: tasksWithOverdue.filter((t) => t.isOverdue).length,
          items: tasksWithOverdue,
        },
      },
      'ESS Dashboard data aggregated successfully.'
    )
  );
});