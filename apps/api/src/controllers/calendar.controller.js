import { CalendarEvent } from '../models/calendarEvent.model.js';
import { Employee } from '../models/employee.model.js';
import { Company } from '../models/company.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Get Calendar Events (Timezone-aware & Scoped by Role/Team)
 */
export const getCalendarEvents = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { start, end, type } = req.query;

  const query = { companyId };

  // Date range filter
  if (start && end) {
    query.startDate = { $lte: new Date(end) };
    query.endDate = { $gte: new Date(start) };
  }

  // Type filter
  if (type) {
    query.type = type.toUpperCase();
  }

  // Role-based visibility scoping
  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;

  if (userRole !== 'COMPANY_ADMIN' && userRole !== 'HR' && userRole !== 'SUPER_ADMIN') {
    // Standard employee or manager: Get employee's department/team
    const employee = await Employee.findOne({
      companyId,
      $or: [{ userId: user._id || user.id }, { _id: user.employeeId }],
    });

    const userTeamId = employee?.departmentId || employee?.teamId || null;

    // Visible if event is company-wide (teamId == null) OR belongs to user's team
    query.$or = [{ teamId: null }, { teamId: userTeamId }];
  }

 const events = await CalendarEvent.find(query)
    .populate('createdBy', 'name email')
    .sort({ startDate: 1 });

  // Get company configured timezone for reference
  const company = await Company.findById(companyId).select('timezone');

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        events,
        timezone: company?.timezone || 'UTC',
      },
      'Calendar events retrieved successfully.'
    )
  );
});

/**
 * 2. Create Calendar Event
 */
export const createCalendarEvent = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { title, description, type, startDate, endDate, isAllDay, teamId } = req.body;

  if (!title || !startDate || !endDate) {
    throw new ApiError(400, 'Title, start date, and end date are required.');
  }

  if (new Date(startDate) > new Date(endDate)) {
    throw new ApiError(400, 'Start date cannot be after end date.');
  }

  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;

  // Guard: Only Admin/HR can create company-wide events (teamId === null)
  if (!teamId && userRole !== 'COMPANY_ADMIN' && userRole !== 'HR' && userRole !== 'SUPER_ADMIN') {
    throw new ApiError(403, 'Only HR or Company Admin can create company-wide events/holidays.');
  }

  const event = await CalendarEvent.create({
    companyId,
    title,
    description: description || '',
    type: type ? type.toUpperCase() : 'OTHER',
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    isAllDay: Boolean(isAllDay),
    teamId: teamId || null,
    source: 'INTERNAL',
    createdBy: user._id || user.id,
  });

  return res.status(201).json(new ApiResponse(201, event, 'Calendar event created successfully.'));
});

/**
 * 3. Update Calendar Event
 */
export const updateCalendarEvent = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { id } = req.params;

  const event = await CalendarEvent.findOne({ _id: id, companyId });
  if (!event) {
    throw new ApiError(404, 'Calendar event not found.');
  }

  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;

  // Permission check: Non-admin can only edit their own created events
  if (
    userRole !== 'COMPANY_ADMIN' &&
    userRole !== 'HR' &&
    event.createdBy.toString() !== (user._id || user.id).toString()
  ) {
    throw new ApiError(403, 'You do not have permission to modify this event.');
  }

  const updatedEvent = await CalendarEvent.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });

  return res.status(200).json(new ApiResponse(200, updatedEvent, 'Calendar event updated successfully.'));
});

/**
 * 4. Delete Calendar Event
 */
export const deleteCalendarEvent = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const user = req.user;
  const { id } = req.params;

  const event = await CalendarEvent.findOne({ _id: id, companyId });
  if (!event) {
    throw new ApiError(404, 'Calendar event not found.');
  }

  const userRole = typeof user.role === 'object' ? user.role.name || user.role.code : user.role;

  if (
    userRole !== 'COMPANY_ADMIN' &&
    userRole !== 'HR' &&
    event.createdBy.toString() !== (user._id || user.id).toString()
  ) {
    throw new ApiError(403, 'You do not have permission to delete this event.');
  }

  await CalendarEvent.findByIdAndDelete(id);

  return res.status(200).json(new ApiResponse(200, null, 'Calendar event deleted successfully.'));
});