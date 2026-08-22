import mongoose from 'mongoose';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Calculates days between start and end date (inclusive)
 */
export const calculateLeaveDays = (startDate, endDate, dayType = 'FULL') => {
  if (dayType === 'HALF_FIRST' || dayType === 'HALF_SECOND') {
    return 0.5;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) {
    throw new ApiError(400, 'End date cannot be earlier than start date.');
  }
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Apply for a new leave request with safe auto-escalation check
 */
export const submitLeaveRequest = async ({
  companyId,
  employeeId,
  leaveTypeId,
  startDate,
  endDate,
  dayType = 'FULL',
  reason,
}) => {
  const totalDays = calculateLeaveDays(startDate, endDate, dayType);
  const leaveYear = new Date(startDate).getFullYear();

  // 1. Verify leave balance exists
  const balance = await LeaveBalance.findOne({
    companyId,
    employeeId,
    leaveTypeId,
    year: leaveYear,
  });

  if (!balance) {
    throw new ApiError(400, `No leave balance record found for year ${leaveYear}.`);
  }

  // 2. Determine initial status based on Manager availability (Auto-escalation)
  const employee = await Employee.findById(employeeId);
  
  let initialStatus = 'PENDING_MANAGER';
  let isEscalated = false;

  const managerId = employee?.reportsTo || employee?.managerId;

  if (!managerId) {
    initialStatus = 'PENDING_HR';
    isEscalated = true;
  } else {
    const manager = await Employee.findById(managerId);
    if (!manager || manager.status !== 'ACTIVE') {
      initialStatus = 'PENDING_HR';
      isEscalated = true;
    }
  }

  const request = await LeaveRequest.create({
    companyId,
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    totalDays,
    dayType,
    reason,
    status: initialStatus,
    isEscalatedToHr: isEscalated,
  });

  return request;
};

/**
 * Manager Approval (Stage 1)
 */
export const approveByManager = async ({
  requestId,
  approverEmployeeId,
  managerNotes = '',
  companyId,
}) => {
  const request = await LeaveRequest.findOne({ _id: requestId, companyId });

  if (!request) {
    throw new ApiError(404, 'Leave request not found.');
  }

  if (request.status !== 'PENDING_MANAGER') {
    throw new ApiError(400, `Cannot perform manager approval. Current status is ${request.status}.`);
  }

  // Self-approval block
  if (request.employeeId.toString() === approverEmployeeId.toString()) {
    throw new ApiError(403, 'Self-approval is blocked: You cannot approve your own leave request.');
  }

  request.status = 'PENDING_HR';
  request.managerApprovedBy = approverEmployeeId;
  request.managerApprovedAt = new Date();
  request.managerNotes = managerNotes;

  await request.save();
  return request;
};

/**
 * HR Approval (Stage 2 - Final Approval with Transactional Atomic Balance Decrement)
 */
export const approveByHr = async ({
  requestId,
  approverEmployeeId,
  hrNotes = '',
  companyId,
  approveAsUnpaid = false,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await LeaveRequest.findOne({ _id: requestId, companyId }).session(session);

    if (!request) {
      throw new ApiError(404, 'Leave request not found.');
    }

    if (request.status !== 'PENDING_HR') {
      throw new ApiError(400, `Cannot perform final HR approval. Current status is ${request.status}. Must be PENDING_HR.`);
    }

    // Self-approval block for HR
    if (request.employeeId.toString() === approverEmployeeId.toString()) {
      throw new ApiError(403, 'Self-approval is blocked: HR cannot approve their own leave request.');
    }

    const leaveYear = new Date(request.startDate).getFullYear();

    // Find and check balance
    const balance = await LeaveBalance.findOne({
      companyId,
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      year: leaveYear,
    }).session(session);

    if (!balance) {
      throw new ApiError(400, `Leave balance record not found for year ${leaveYear}.`);
    }

    // Zero balance guard
    if (balance.remaining < request.totalDays) {
      if (!approveAsUnpaid) {
        throw new ApiError(
          400,
          `Insufficient leave balance (Remaining: ${balance.remaining}, Requested: ${request.totalDays}). To proceed, approver must explicitly set 'approveAsUnpaid: true'.`
        );
      }
      request.isUnpaidOverride = true;
    } else {
      const updatedBalance = await LeaveBalance.findOneAndUpdate(
        {
          _id: balance._id,
          remaining: { $gte: request.totalDays },
        },
        {
          $inc: {
            used: request.totalDays,
            remaining: -request.totalDays,
          },
        },
        { new: true, session }
      );

      if (!updatedBalance) {
        throw new ApiError(409, 'Concurrent balance update detected. Please retry approval.');
      }
    }

    request.status = 'APPROVED';
    request.hrApprovedBy = approverEmployeeId;
    request.hrApprovedAt = new Date();
    request.hrNotes = hrNotes;

    await request.save({ session });

    await session.commitTransaction();
    session.endSession();

    return request;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Reject Leave Request (Manager or HR)
 */
export const rejectLeaveRequest = async ({
  requestId,
  approverEmployeeId,
  rejectionReason,
  companyId,
}) => {
  const request = await LeaveRequest.findOne({ _id: requestId, companyId });

  if (!request) {
    throw new ApiError(404, 'Leave request not found.');
  }

  if (!['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) {
    throw new ApiError(400, `Cannot reject leave in status '${request.status}'.`);
  }

  if (request.employeeId.toString() === approverEmployeeId.toString()) {
    throw new ApiError(403, 'Self-action blocked: You cannot reject your own leave request.');
  }

  request.status = 'REJECTED';
  request.rejectedBy = approverEmployeeId;
  request.rejectionReason = rejectionReason || 'Leave request rejected by approver.';

  await request.save();
  return request;
};