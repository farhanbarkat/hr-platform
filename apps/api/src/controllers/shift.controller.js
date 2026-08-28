import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ShiftTemplate } from '../models/shiftTemplate.model.js';
import { ShiftAssignment } from '../models/shiftAssignment.model.js';
import { Employee } from '../models/employee.model.js';

/**
 * 1. Create Shift Template
 */
export const createShiftTemplate = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { name, startTime, endTime, gracePeriodOverride, isNightShift } = req.body;

  if (!name || !startTime || !endTime) {
    throw new ApiError(400, 'Shift name, startTime (HH:mm), and endTime (HH:mm) are required.');
  }

  const existing = await ShiftTemplate.findOne({ companyId, name: name.trim() });
  if (existing) {
    throw new ApiError(409, `Shift template '${name}' already exists.`);
  }

  const template = await ShiftTemplate.create({
    companyId,
    name: name.trim(),
    startTime,
    endTime,
    gracePeriodOverride: gracePeriodOverride !== undefined ? Number(gracePeriodOverride) : null,
    isNightShift: Boolean(isNightShift),
    createdBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, template, 'Shift template created successfully.')
  );
});

/**
 * 2. Get All Shift Templates
 */
export const getShiftTemplates = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const templates = await ShiftTemplate.find({ companyId, isActive: true }).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, { templates }, 'Shift templates retrieved successfully.')
  );
});

/**
 * 3. Update Shift Template
 */
export const updateShiftTemplate = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { name, startTime, endTime, gracePeriodOverride, isNightShift, isActive } = req.body;

  const template = await ShiftTemplate.findOneAndUpdate(
    { _id: id, companyId },
    {
      $set: {
        ...(name && { name: name.trim() }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(gracePeriodOverride !== undefined && { gracePeriodOverride }),
        ...(isNightShift !== undefined && { isNightShift }),
        ...(isActive !== undefined && { isActive }),
      },
    },
    { new: true }
  );

  if (!template) {
    throw new ApiError(404, 'Shift template not found.');
  }

  return res.status(200).json(
    new ApiResponse(200, template, 'Shift template updated successfully.')
  );
});

/**
 * 4. Assign Shift to Employee (Supports Date Ranges & Overlapping Checks)
 */
export const assignShift = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { employeeId, shiftTemplateId, startDate, endDate, inchargeId } = req.body;

  if (!employeeId || !shiftTemplateId || !startDate) {
    throw new ApiError(400, 'Employee ID, Shift Template ID, and Start Date are required.');
  }

  const employee = await Employee.findOne({ companyId, _id: employeeId });
  if (!employee) {
    throw new ApiError(404, 'Employee not found in this company.');
  }

  const shiftTemplate = await ShiftTemplate.findOne({ _id: shiftTemplateId, companyId, isActive: true });
  if (!shiftTemplate) {
    throw new ApiError(404, 'Shift template not found or inactive.');
  }

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  if (end && end < start) {
    throw new ApiError(400, 'End date cannot be earlier than start date.');
  }

  // Prevent overlapping active shift assignments for same employee
  const overlapQuery = {
    companyId,
    employeeId,
    status: 'ACTIVE',
    $or: [
      { endDate: null, startDate: { $lte: end || new Date('2099-12-31') } },
      {
        startDate: { $lte: end || new Date('2099-12-31') },
        endDate: { $gte: start },
      },
    ],
  };

  const existingOverlap = await ShiftAssignment.findOne(overlapQuery);
  if (existingOverlap) {
    // If overlapping, auto-close previous assignment or throw conflict
    existingOverlap.endDate = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    existingOverlap.status = 'COMPLETED';
    await existingOverlap.save();
  }

  const assignment = await ShiftAssignment.create({
    companyId,
    employeeId,
    shiftTemplateId,
    startDate: start,
    endDate: end,
    inchargeId: inchargeId || null,
    status: 'ACTIVE',
    assignedBy: req.user._id,
  });

  const populated = await ShiftAssignment.findById(assignment._id)
    .populate('employeeId', 'firstName lastName employeeId designation')
    .populate('shiftTemplateId', 'name startTime endTime gracePeriodOverride isNightShift')
    .populate('inchargeId', 'firstName lastName employeeId designation');

  return res.status(201).json(
    new ApiResponse(201, populated, 'Shift assigned successfully.')
  );
});

/**
 * 5. Get Shift Assignments (Filter by Date Range, Employee, or Incharge)
 */
export const getShiftAssignments = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { employeeId, inchargeId, status, date } = req.query;

  const query = { companyId };
  if (employeeId) query.employeeId = employeeId;
  if (inchargeId) query.inchargeId = inchargeId;
  if (status) query.status = status;

  if (date) {
    const targetDate = new Date(date);
    query.startDate = { $lte: targetDate };
    query.$or = [{ endDate: null }, { endDate: { $gte: targetDate } }];
  }

  const assignments = await ShiftAssignment.find(query)
    .populate('employeeId', 'firstName lastName employeeId designation email')
    .populate('shiftTemplateId', 'name startTime endTime gracePeriodOverride isNightShift')
    .populate('inchargeId', 'firstName lastName employeeId designation')
    .sort({ startDate: -1 });

  return res.status(200).json(
    new ApiResponse(200, { assignments }, 'Shift assignments retrieved successfully.')
  );
});

/**
 * 6. Helper: Resolve Employee Effective Shift for Attendance Calculation (TICKET-011 integration)
 */
export const getEffectiveShiftForDate = async (companyId, employeeId, targetDate = new Date()) => {
  const assignment = await ShiftAssignment.findOne({
    companyId,
    employeeId,
    status: 'ACTIVE',
    startDate: { $lte: targetDate },
    $or: [{ endDate: null }, { endDate: { $gte: targetDate } }],
  }).populate('shiftTemplateId');

  return assignment ? assignment.shiftTemplateId : null;
};