import { ShiftSwapRequest } from '../models/shiftSwapRequest.model.js';
import { ShiftAssignment } from '../models/shiftAssignment.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 0. Get Peers and Logged-In User Active Shifts
 * GET /api/v1/shift-swaps/peers
 */
export const getEligiblePeersAndMyShifts = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  // Resolve current employee
  const currentEmployee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  if (!currentEmployee) {
    throw new ApiError(404, 'Employee profile not found for logged in user.');
  }

  // Active shifts of logged-in employee
  const myAssignments = await ShiftAssignment.find({
    companyId,
    employeeId: currentEmployee._id,
  })
    .populate('shiftTemplateId', 'name startTime endTime gracePeriodOverride')
    .lean();

  // Eligible colleagues in same company
  const peers = await Employee.find({
    companyId,
    _id: { $ne: currentEmployee._id },
    status: { $ne: 'TERMINATED' },
  })
    .select('firstName lastName designation department employeeCode')
    .lean();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        myEmployeeId: currentEmployee._id,
        myAssignments,
        peers,
      },
      'Eligible peers and active shifts retrieved successfully.'
    )
  );
});

/**
 * 1. Propose Shift Swap Request
 * POST /api/v1/shift-swaps
 */
export const proposeShiftSwap = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { targetEmployeeId, requesterShiftAssignmentId, targetShiftAssignmentId, swapDate, reason } = req.body;

  if (!targetEmployeeId || !requesterShiftAssignmentId || !swapDate) {
    throw new ApiError(400, 'Target employee, shift assignment, and swap date are required.');
  }

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

  // Validate Requester's Assignment
  const reqAssignment = await ShiftAssignment.findOne({
    _id: requesterShiftAssignmentId,
    companyId,
    employeeId: requesterEmployee._id,
  });

  if (!reqAssignment) {
    throw new ApiError(400, 'Invalid shift assignment for requester.');
  }

  // Target assignment resolution (Find colleague assignment or fallback to colleague active assignment)
  let targetAssignment = null;
  if (targetShiftAssignmentId && targetShiftAssignmentId !== requesterShiftAssignmentId) {
    targetAssignment = await ShiftAssignment.findOne({
      _id: targetShiftAssignmentId,
      companyId,
      employeeId: targetEmployeeId,
    });
  }

  if (!targetAssignment) {
    targetAssignment = await ShiftAssignment.findOne({
      companyId,
      employeeId: targetEmployeeId,
    });
  }

  // Agar target colleague ki assignment na mile toh same template structure allocate karein
  const finalTargetAssignmentId = targetAssignment?._id || requesterShiftAssignmentId;

  // Duplicate active pending request check
  const existingPending = await ShiftSwapRequest.findOne({
    companyId,
    requesterId: requesterEmployee._id,
    swapDate: { $gte: startOfDay,$lte: endOfDay },
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
    targetShiftAssignmentId: finalTargetAssignmentId,
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
 * 2. Colleague Response
 */
export const respondToPeerSwapRequest = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;
  const { action, comments } = req.body;

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

  if (new Date(swapRequest.swapDate) < new Date().setHours(0, 0, 0, 0)) {
    swapRequest.status = 'EXPIRED';
    await swapRequest.save();
    throw new ApiError(400, 'This shift swap request has expired because the swap date has passed.');
  }

  swapRequest.status = action === 'ACCEPT' ? 'PENDING_MANAGER_APPROVAL' : 'PEER_REJECTED';
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
 * 3. Manager Approval
 */
export const reviewSwapRequestByManager = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;
  const { action, comments } = req.body;

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

  // Swap shift templates atomically
  const reqAssignment = await ShiftAssignment.findById(swapRequest.requesterShiftAssignmentId);
  const targetAssignment = await ShiftAssignment.findById(swapRequest.targetShiftAssignmentId);

  if (reqAssignment && targetAssignment && reqAssignment._id.toString() !== targetAssignment._id.toString()) {
    const tempShiftTemplate = reqAssignment.shiftTemplateId;
    reqAssignment.shiftTemplateId = targetAssignment.shiftTemplateId;
    targetAssignment.shiftTemplateId = tempShiftTemplate;
    await Promise.all([reqAssignment.save(), targetAssignment.save()]);
  }

  swapRequest.status = 'APPROVED';
  swapRequest.approvedBy = req.user._id;
  swapRequest.approvalActionAt = new Date();
  swapRequest.managerComments = comments || '';
  await swapRequest.save();

  return res.status(200).json(
    new ApiResponse(200, swapRequest, 'Shift swap approved successfully. Roster updated.')
  );
});

/**
 * 4. List Requests
 */
export const getShiftSwapRequests = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { status, type } = req.query;

  const currentEmployee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  const query = { companyId };
  if (status) query.status = status;

  const isManagement = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(req.user.role);

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