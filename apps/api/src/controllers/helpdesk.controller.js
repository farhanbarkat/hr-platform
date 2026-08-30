import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { HelpdeskTicket } from '../models/helpdeskTicket.model.js';
import { TicketComment } from '../models/ticketComment.model.js';
import { User } from '../models/user.model.js';

/**
 * Helper: Generate Tenant-Scoped Unique Ticket Identifier
 */
const generateTicketNumber = () => {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HD-${Date.now().toString().slice(-6)}-${randomSuffix}`;
};

/**
 * 1. Raise a Ticket (Employee ESS Flow)
 */
export const raiseTicket = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const raisedBy = new mongoose.Types.ObjectId(req.user._id);
  const { title, description, category, priority, attachedRecord } = req.body;

  if (!title || !description || !category) {
    throw new ApiError(400, 'Title, description, and category are required to create a ticket.');
  }

  const validRecordTypes = ['PAYSLIP', 'ATTENDANCE', 'LEAVE_REQUEST', 'LOAN', 'NONE'];
  if (attachedRecord?.recordType && !validRecordTypes.includes(attachedRecord.recordType)) {
    throw new ApiError(400, 'Invalid attached record type.');
  }

  const ticket = await HelpdeskTicket.create({
    companyId,
    ticketNumber: generateTicketNumber(),
    title,
    description,
    category,
    priority: priority || 'MEDIUM',
    raisedBy,
    attachedRecord: attachedRecord || { recordType: 'NONE' },
  });

  const populated = await HelpdeskTicket.findById(ticket._id)
    .populate('raisedBy', 'email role')
    .populate('assignedTo', 'email role');

  return res.status(201).json(
    new ApiResponse(201, populated, 'Helpdesk ticket raised successfully.')
  );
});

/**
 * 2. Get Employee's Raised Tickets (ESS View)
 */
export const getMyTickets = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const raisedBy = new mongoose.Types.ObjectId(req.user._id);
  const { status, category } = req.query;

  const query = { companyId, raisedBy };
  if (status) query.status = status;
  if (category) query.category = category;

  const tickets = await HelpdeskTicket.find(query)
    .populate('assignedTo', 'email role')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, tickets, 'Employee tickets retrieved successfully.')
  );
});

/**
 * 3. HR Queue / Triage View (Filtered by Status, Category, Priority, Assignee)
 */
export const getTriageQueue = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { status, category, priority, assignedTo, page = 1, limit = 20 } = req.query;

  const query = { companyId };
  if (status) query.status = status;
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
    query.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [tickets, total] = await Promise.all([
    HelpdeskTicket.find(query)
      .populate('raisedBy', 'email role')
      .populate('assignedTo', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    HelpdeskTicket.countDocuments(query),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        tickets,
        pagination: {
          total,
          page: parseInt(page, 10),
          pages: Math.ceil(total / parseInt(limit, 10)) || 1,
          limit: parseInt(limit, 10),
        },
      },
      'Helpdesk triage queue retrieved.'
    )
  );
});

/**
 * 4. Get Ticket Details by ID
 */
export const getTicketDetails = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { ticketId } = req.params;
  const user = req.user;

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID.');
  }

  const ticket = await HelpdeskTicket.findOne({
    _id: new mongoose.Types.ObjectId(ticketId),
    companyId,
  })
    .populate('raisedBy', 'email role')
    .populate('assignedTo', 'email role');

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found.');
  }

  const isRaiser = ticket.raisedBy._id.toString() === user._id.toString();
  const isAssigned = ticket.assignedTo?._id.toString() === user._id.toString();
  const isPrivileged = ['COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'HR'].includes(user.role);

  if (!isRaiser && !isAssigned && !isPrivileged) {
    throw new ApiError(403, 'Unauthorized to view this ticket.');
  }

  const commentQuery = {
    companyId,
    ticketId: new mongoose.Types.ObjectId(ticketId),
  };
  if (!isPrivileged && !isAssigned) {
    commentQuery.isInternalNote = false;
  }

  const comments = await TicketComment.find(commentQuery)
    .populate('authorId', 'email role')
    .sort({ createdAt: 1 });

  return res.status(200).json(
    new ApiResponse(200, { ticket, comments }, 'Ticket details and thread retrieved.')
  );
});

/**
 * 5. Triage Update: Assign, Change Status, or Add Resolution (HR/Admin Only)
 */
export const updateTicketTriage = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { ticketId } = req.params;
  const { status, assignedTo, priority, resolutionNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID.');
  }

  const ticket = await HelpdeskTicket.findOne({
    _id: new mongoose.Types.ObjectId(ticketId),
    companyId,
  });

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found.');
  }

  if (assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      throw new ApiError(400, 'Invalid assigned user ID.');
    }
    const assignee = await User.findOne({
      _id: new mongoose.Types.ObjectId(assignedTo),
      companyId,
    });
    if (!assignee) {
      throw new ApiError(404, 'Assigned user does not exist in your company.');
    }
    ticket.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  }

  if (status) {
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, 'Invalid ticket status.');
    }
    ticket.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      ticket.resolvedAt = new Date();
    }
  }

  if (priority) {
    ticket.priority = priority;
  }

  if (resolutionNotes !== undefined) {
    ticket.resolutionNotes = resolutionNotes;
  }

  await ticket.save();

  const populated = await HelpdeskTicket.findById(ticket._id)
    .populate('raisedBy', 'email role')
    .populate('assignedTo', 'email role');

  return res.status(200).json(
    new ApiResponse(200, populated, 'Ticket updated successfully.')
  );
});

/**
 * 6. Add Comment to Ticket Thread
 */
export const addTicketComment = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const { ticketId } = req.params;
  const authorId = new mongoose.Types.ObjectId(req.user._id);
  const { body, isInternalNote = false } = req.body;

  if (!body || !body.trim()) {
    throw new ApiError(400, 'Comment body is required.');
  }

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new ApiError(400, 'Invalid ticket ID.');
  }

  const ticket = await HelpdeskTicket.findOne({
    _id: new mongoose.Types.ObjectId(ticketId),
    companyId,
  });

  if (!ticket) {
    throw new ApiError(404, 'Ticket not found.');
  }

  const isRaiser = ticket.raisedBy.toString() === authorId.toString();
  const isAssigned = ticket.assignedTo?.toString() === authorId.toString();
  const isPrivileged = ['COMPANY_ADMIN', 'HR_ADMIN', 'HR_MANAGER', 'HR'].includes(req.user.role);

  if (!isRaiser && !isAssigned && !isPrivileged) {
    throw new ApiError(403, 'Unauthorized to comment on this ticket.');
  }

  const internalFlag = isPrivileged ? Boolean(isInternalNote) : false;

  const comment = await TicketComment.create({
    companyId,
    ticketId: new mongoose.Types.ObjectId(ticketId),
    authorId,
    body: body.trim(),
    isInternalNote: internalFlag,
  });

  const populated = await TicketComment.findById(comment._id).populate('authorId', 'email role');

  return res.status(201).json(
    new ApiResponse(201, populated, 'Comment added to ticket.')
  );
});