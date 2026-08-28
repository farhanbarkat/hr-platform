import { ShiftSwapRequest } from '../models/shiftSwapRequest.model.js';
import { ShiftAssignment } from '../models/shiftAssignment.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Propose Shift Swap Request (Requester Employee)
 * POST /api/v1/shift-swaps
 */
export const proposeShiftSwap = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { targetEmployeeId, requesterShiftAssignmentId, targetShiftAssignmentId, swapDate, reason } = req.body;

  if (!targetEmployeeId || !requesterShiftAssignmentId || !targetShiftAssignmentId || !swapDate) {
    throw new ApiError(400, 'Target employee, shift assignments, and swap date are required.');
  }

  // 1. Resolve logged-in employee profile
  const requesterEmployee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  if (!requesterEmployee) {
    throw new ApiError(404, 'Requester employee profile not found.');
  }

  if (requesterEmployee._id.toString() === targetEmployeeId) {
    throw new ApiError(400, 'You cannot propose a shift swap with yourself.');
  }

  const parsedSwapDate = new Date(swapDate);
  const startOfDay = new Date(parsedSwapDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(parsedSwapDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 2. Validate Requester's Assignment
  const reqAssignment = await ShiftAssignment.findOne({
    _id: requesterShiftAssignmentId,
    companyId,
    employeeId: requesterEmployee._id,
    startDate: { $lte: endOfDay },
    $or: [{ endDate: null }, { endDate: { $gte: startOfDay } }],
  });

  if (!reqAssignment) {
    throw new ApiError(400, 'Invalid or inactive shift assignment for requester on this date.');
  }

  // 3. Validate Target's Assignment
  const targetAssignment = await ShiftAssignment.findOne({
    _id: targetShiftAssignmentId,
    companyId,
    employeeId: targetEmployeeId,
    startDate: { $lte: endOfDay },
    $or: [{ endDate: null }, { endDate: { $gte: startOfDay } }],
  });

  if (!targetAssignment) {
    throw new ApiError(400, 'Invalid or inactive shift assignment for target colleague on this date.');
  }

  // 4. Prevent duplicate pending requests for the same date & employee
  const existingPending = await ShiftSwapRequest.findOne({
    companyId,
    requesterId: requesterEmployee._id,
    swapDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['PENDING_PEER_ACCEPTANCE', 'PENDING_MANAGER_APPROVAL'] },
  });

  if (existingPending) {
    throw new ApiError(409, 'You already have an active pending shift swap request for this date.');
  }

  const swapRequest = await ShiftSwapRequest.create({
    companyId,
    requesterId: requesterEmployee._id,
    targetEmployeeId,
    requesterShiftAssignmentId,
    targetShiftAssignmentId,
    swapDate: parsedSwapDate,
    reason: reason || '',
    status: 'PENDING_PEER_ACCEPTANCE',
  });

  const populated = await ShiftSwapRequest.findById(swapRequest._id)
    .populate('requesterId', 'firstName lastName email employeeCode designation')
    .populate('targetEmployeeId', 'firstName lastName email employeeCode designation')
    .populate({
      path: 'requesterShiftAssignmentId',
      populate: { path: 'shiftTemplateId', select: 'name startTime endTime' },
    })
    .populate({
      path: 'targetShiftAssignmentId',
      populate: { path: 'shiftTemplateId', select: 'name startTime endTime' },
    });

  return res.status(201).json(
    new ApiResponse(201, populated, 'Shift swap request proposed. Awaiting colleague acceptance.')
  );
});

/**
 * 2. Target Colleague Accepts or Rejects Swap Request
 * PUT /api/v1/shift-swaps/:id/peer-response
 */
export const respondToPeerSwapRequest = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;
  const { action, comments } = req.body; // action: "ACCEPT" | "REJECT"

  if (!['ACCEPT', 'REJECT'].includes(action)) {
    throw new ApiError(400, 'Action must be either ACCEPT or REJECT.');
  }

  const currentEmployee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  if (!currentEmployee) {
    throw new ApiError(404, 'Employee profile not found.');
  }

  const swapRequest = await ShiftSwapRequest.findOne({
    _id: id,
    companyId,
    targetEmployeeId: currentEmployee._id,
  });

  if (!swapRequest) {
    throw new ApiError(404, 'Shift swap request not found or not assigned to you.');
  }

  if (swapRequest.status !== 'PENDING_PEER_ACCEPTANCE') {
    throw new ApiError(400, `Cannot respond. Request status is already ${swapRequest.status}.`);
  }

  // Check if swap date is in past
  if (new Date(swapRequest.swapDate) < new Date().setHours(0, 0, 0, 0)) {
    swapRequest.status = 'EXPIRED';
    await swapRequest.save();
    throw new ApiError(400, 'This shift swap request has expired because the swap date has passed.');
  }

  if (action === 'ACCEPT') {
    swapRequest.status = 'PENDING_MANAGER_APPROVAL';
  } else {
    swapRequest.status = 'PEER_REJECTED';
  }

  swapRequest.peerActionAt = new Date();
  swapRequest.peerComments = comments || '';
  await swapRequest.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      swapRequest,
      action === 'ACCEPT'
        ? 'Swap accepted by colleague. Forwarded for manager/incharge approval.'
        : 'Swap request declined.'
    )
  );
});

/**
 * 3. Manager / Shift Incharge Final Approval or Rejection
 * PUT /api/v1/shift-swaps/:id/manager-approval
 */
export const reviewSwapRequestByManager = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;
  const { action, comments } = req.body; // action: "APPROVE" | "REJECT"

  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw new ApiError(400, 'Action must be either APPROVE or REJECT.');
  }

  const swapRequest = await ShiftSwapRequest.findOne({
    _id: id,
    companyId,
  });

  if (!swapRequest) {
    throw new ApiError(404, 'Shift swap request not found.');
  }

  if (swapRequest.status !== 'PENDING_MANAGER_APPROVAL') {
    throw new ApiError(
      400,
      `Cannot process approval. Swap request must be accepted by the peer first (Current status: ${swapRequest.status}).`
    );
  }

  if (new Date(swapRequest.swapDate) < new Date().setHours(0, 0, 0, 0)) {
    swapRequest.status = 'EXPIRED';
    await swapRequest.save();
    throw new ApiError(400, 'This shift swap request has expired because the swap date has passed.');
  }

  if (action === 'REJECT') {
    swapRequest.status = 'MANAGER_REJECTED';
    swapRequest.approvedBy = req.user._id;
    swapRequest.approvalActionAt = new Date();
    swapRequest.managerComments = comments || '';
    await swapRequest.save();

    return res.status(200).json(
      new ApiResponse(200, swapRequest, 'Shift swap request rejected by manager.')
    );
  }

  // APPROVED: Atomically swap shift templates on both assignment records
  const reqAssignment = await ShiftAssignment.findById(swapRequest.requesterShiftAssignmentId);
  const targetAssignment = await ShiftAssignment.findById(swapRequest.targetShiftAssignmentId);

  if (!reqAssignment || !targetAssignment) {
    throw new ApiError(404, 'One or both shift assignments could not be found.');
  }

  // Swap the shiftTemplateId between assignments
  const tempShiftTemplate = reqAssignment.shiftTemplateId;
  reqAssignment.shiftTemplateId = targetAssignment.shiftTemplateId;
  targetAssignment.shiftTemplateId = tempShiftTemplate;

  await Promise.all([reqAssignment.save(), targetAssignment.save()]);

  swapRequest.status = 'APPROVED';
  swapRequest.approvedBy = req.user._id;
  swapRequest.approvalActionAt = new Date();
  swapRequest.managerComments = comments || '';
  await swapRequest.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      swapRequest,
      'Shift swap approved successfully. Roster assignments have been updated.'
    )
  );
});

/**
 * 4. List Shift Swap Requests (ESS & Manager List)
 * GET /api/v1/shift-swaps
 */
export const getShiftSwapRequests = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { status, type } = req.query; // type: 'sent' | 'received' | 'all'

  const currentEmployee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  const query = { companyId };
  if (status) query.status = status;

  const isManagement = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'MANAGER'].includes(req.user.role);

  if (!isManagement || type === 'sent') {
    query.requesterId = currentEmployee?._id;
  } else if (type === 'received') {
    query.targetEmployeeId = currentEmployee?._id;
  }

  const swapRequests = await ShiftSwapRequest.find(query)
    .populate('requesterId', 'firstName lastName email employeeCode designation')
    .populate('targetEmployeeId', 'firstName lastName email employeeCode designation')
    .populate({
      path: 'requesterShiftAssignmentId',
      populate: { path: 'shiftTemplateId', select: 'name startTime endTime gracePeriodOverride' },
    })
    .populate({
      path: 'targetShiftAssignmentId',
      populate: { path: 'shiftTemplateId', select: 'name startTime endTime gracePeriodOverride' },
    })
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, swapRequests, 'Shift swap requests retrieved successfully.')
  );
});