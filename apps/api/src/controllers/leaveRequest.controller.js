import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Employee } from '../models/employee.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
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