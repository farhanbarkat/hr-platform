import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Employee } from '../models/employee.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { LeaveStatusHistory } from '../models/leaveStatusHistory.model.js';
import {
  submitLeaveRequest,
  approveByManager,
  approveByHr,
  rejectLeaveRequest,
} from '../services/leaveWorkflow.service.js';


export const getEmployeeForUser = async (user) => {
  if (user.employeeId) {
    const emp = await Employee.findById(user.employeeId);
    if (emp) return emp;
  }

  let employee = await Employee.findOne({ userId: user._id });
  if (employee) return employee;

  if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') {
    employee = await Employee.findOneAndUpdate(
      { email: user.email, companyId: user.companyId },
      {
        userId: user._id,
        companyId: user.companyId,
        name: user.name || 'System Admin',
        email: user.email,
        department: 'Administration',
        designation: 'Administrator',
        status: 'ACTIVE',
      },
      { upsert: true, new: true }
    );
    return employee;
  }

  throw new ApiError(404, 'No employee record linked with current user session.');
};

// 1. Apply Leave
export const applyLeave = asyncHandler(async (req, res) => {
  const { leaveTypeId, startDate, endDate, dayType, reason } = req.body;

  if (!leaveTypeId || !startDate || !endDate) {
    throw new ApiError(400, 'leaveTypeId, startDate, and endDate are required.');
  }

  const employee = await getEmployeeForUser(req.user);

  const request = await submitLeaveRequest({
    companyId: req.user.companyId,
    employeeId: employee._id,
    leaveTypeId,
    startDate,
    endDate,
    dayType: dayType || 'FULL',
    reason,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, request, 'Leave request submitted successfully.'));
});
export const applyLeaveRequest = applyLeave;

// 2. Manager Approve (Stage 1)
export const managerApprove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const employee = await getEmployeeForUser(req.user);

  const request = await approveByManager({
    requestId: id,
    approverEmployeeId: employee._id,
    managerNotes: notes,
    companyId: req.user.companyId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, request, 'Leave request approved by manager (Stage 1).'));
});
export const managerApproveRequest = managerApprove;

// 3. HR Approve (Stage 2)
export const hrApprove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, approveAsUnpaid } = req.body;

  const employee = await getEmployeeForUser(req.user);

  const request = await approveByHr({
    requestId: id,
    approverEmployeeId: employee._id,
    hrNotes: notes,
    companyId: req.user.companyId,
    approveAsUnpaid: !!approveAsUnpaid,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, request, 'Leave request approved by HR and balance deducted.'));
});
export const hrApproveRequest = hrApprove;

// 4. Reject Leave
export const rejectLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const employee = await getEmployeeForUser(req.user);

  const request = await rejectLeaveRequest({
    requestId: id,
    approverEmployeeId: employee._id,
    rejectionReason: reason,
    companyId: req.user.companyId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, request, 'Leave request rejected successfully.'));
});
export const rejectLeaveRequest_alias = rejectLeave;
export { rejectLeave as rejectLeaveRequestHandler };

// 5. Get My Requests (ESS)
export const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const { year, status } = req.query;
  const employee = await getEmployeeForUser(req.user);

  let filter = {
    companyId: req.user.companyId,
    employeeId: employee._id,
  };

  if (status) filter.status = status;
  if (year) {
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);
    filter.startDate = { $gte: startOfYear, $lte: endOfYear };
  }

  const requests = await LeaveRequest.find(filter)
    .populate('leaveTypeId', 'name code isPaid')
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, requests, 'Your leave requests retrieved successfully.'));
});

// 6. Get Pending Approvals
export const getPendingApprovals = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user);

  let filter = {
    companyId: req.user.companyId,
    status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] },
  };

  const pendingRequests = await LeaveRequest.find(filter)
    .populate('employeeId', 'name email department')
    .populate('leaveTypeId', 'name code isPaid')
    .sort({ createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, pendingRequests, 'Pending approvals retrieved successfully.'));
});
export const rejectRequest = rejectLeave;

/**
 * 7. Get complete status audit timeline for a specific leave request
 */
export const getLeaveRequestTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId || req.user?.companyId;

  const leaveRequest = await LeaveRequest.findOne({ _id: id, companyId })
    .populate('leaveTypeId', 'name code')
    .populate('employeeId', 'firstName lastName email designation');

  if (!leaveRequest) {
    throw new ApiError(404, 'Leave request not found.');
  }

  // If role is EMPLOYEE, restrict access to own request
  if (req.user.role === 'EMPLOYEE') {
    const employee = await Employee.findOne({
      $or: [{ userId: req.user._id }, { email: req.user.email }],
      companyId,
    });

    if (
      !employee ||
      leaveRequest.employeeId._id.toString() !== employee._id.toString()
    ) {
      throw new ApiError(
        403,
        'Access denied: You can only view your own leave history.'
      );
    }
  }

  const timeline = await LeaveStatusHistory.find({
    leaveRequestId: id,
    companyId,
  })
    .populate('actedBy', 'name email role')
    .sort({ timestamp: 1 });

  return res.status(200).json(
    new ApiResponse(
      200,
      { leaveRequest, timeline },
      'Leave request timeline retrieved.'
    )
  );
});

/**
 * 8. ESS: Get employee's full leave history with embedded timeline
 */
export const getMyLeaveHistory = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;

  const employee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  if (!employee) {
    throw new ApiError(404, 'Employee profile not found.');
  }

  const requests = await LeaveRequest.find({
    employeeId: employee._id,
    companyId,
  })
    .populate('leaveTypeId', 'name code')
    .sort({ createdAt: -1 });

  const requestIds = requests.map((r) => r._id);

  const histories = await LeaveStatusHistory.find({
    leaveRequestId: { $in: requestIds },
  })
    .populate('actedBy', 'name email role')
    .sort({ timestamp: 1 });

  const historyMap = {};

  histories.forEach((h) => {
    const key = h.leaveRequestId.toString();

    if (!historyMap[key]) {
      historyMap[key] = [];
    }

    historyMap[key].push(h);
  });

  const enrichedRequests = requests.map((r) => ({
    ...r.toObject(),
    timeline: historyMap[r._id.toString()] || [],
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      enrichedRequests,
      'Full leave history retrieved.'
    )
  );
});

/**
 * 9. PRD Success Metric: Average Leave Approval Turnaround Time
 */
export const getLeaveApprovalTurnaroundAnalytics = asyncHandler(
  async (req, res) => {
    const companyId = req.companyId || req.user?.companyId;

    const resolved = await LeaveStatusHistory.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId.toString()),
        },
      },
      {
        $sort: {
          timestamp: 1,
        },
      },
      {
        $group: {
          _id: '$leaveRequestId',

          firstEntry: {
            $first: '$$ROOT',
          },

          finalEntry: {
            $last: {
              $cond: [
                {
                  $in: [
                    '$toStatus',
                    ['APPROVED', 'REJECTED', 'CANCELLED'],
                  ],
                },
                '$$ROOT',
                null,
              ],
            },
          },
        },
      },
      {
        $match: {
          finalEntry: {
            $ne: null,
          },
        },
      },
      {
        $project: {
          leaveRequestId: '$_id',

          submittedAt: '$firstEntry.timestamp',

          resolvedAt: '$finalEntry.timestamp',

          durationHours: {
            $divide: [
              {
                $subtract: [
                  '$finalEntry.timestamp',
                  '$firstEntry.timestamp',
                ],
              },
              1000 * 60 * 60,
            ],
          },

          finalStatus: '$finalEntry.toStatus',
        },
      },
    ]);

    const count = resolved.length;

    const totalHours = resolved.reduce(
      (acc, curr) => acc + curr.durationHours,
      0
    );

    const avgHours =
      count > 0
        ? (totalHours / count).toFixed(2)
        : 0;

    const avgDays =
      count > 0
        ? (avgHours / 24).toFixed(2)
        : 0;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          totalResolvedRequests: count,
          averageTurnaroundHours: Number(avgHours),
          averageTurnaroundDays: Number(avgDays),
          breakdown: resolved,
        },
        'Turnaround metrics calculated successfully.'
      )
    );
  }
);