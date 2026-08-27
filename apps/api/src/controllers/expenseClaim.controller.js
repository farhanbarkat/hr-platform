import mongoose from 'mongoose';
import { ExpenseClaim } from '../models/expenseClaim.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Submit a new expense claim (Employee Self-Service)
 * POST /api/v1/expenses
 */
export const submitExpenseClaim = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { category, amount, description, receiptDocumentId } = req.body;

  if (!category || !amount || !description) {
    throw new ApiError(400, 'Category, amount, and description are required.');
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new ApiError(400, 'Amount must be a positive number.');
  }

  // Resolve employee identity from logged-in user
  const employee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found for logged-in user.');
  }

  const claim = await ExpenseClaim.create({
    companyId,
    employeeId: employee._id,
    category: category.toUpperCase(),
    amount: mongoose.Types.Decimal128.fromString(parsedAmount.toFixed(2)),
    description,
    receiptDocumentId: receiptDocumentId || null,
    status: 'PENDING',
  });

  return res.status(201).json(
    new ApiResponse(201, claim, 'Expense claim submitted successfully.')
  );
});

/**
 * 2. Get my submitted claims (ESS History & Status)
 * GET /api/v1/expenses/my-claims
 */
export const getMyExpenseClaims = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  const employee = await Employee.findOne({
    $or: [{ userId: req.user._id }, { email: req.user.email }],
    companyId,
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found.');
  }

  const claims = await ExpenseClaim.find({
    companyId,
    employeeId: employee._id,
  })
    .populate('receiptDocumentId', 'name fileUrl fileType size')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const formattedClaims = claims.map((claim) => ({
    ...claim,
    amount: claim.amount ? parseFloat(claim.amount.toString()) : 0,
  }));

  return res.status(200).json(
    new ApiResponse(200, formattedClaims, 'My expense claims retrieved successfully.')
  );
});

/**
 * 3. Get all pending claims queue (HR / Manager Review Queue)
 * GET /api/v1/expenses/queue
 */
export const getExpenseApprovalQueue = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { status = 'PENDING' } = req.query;

  const query = { companyId };
  if (status) {
    query.status = status.toUpperCase();
  }

  const claims = await ExpenseClaim.find(query)
    .populate('employeeId', 'firstName lastName email designation departmentId employeeCode')
    .populate('receiptDocumentId', 'name fileUrl fileType size')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const formattedClaims = claims.map((claim) => ({
    ...claim,
    amount: claim.amount ? parseFloat(claim.amount.toString()) : 0,
  }));

  return res.status(200).json(
    new ApiResponse(200, formattedClaims, 'Expense approval queue retrieved successfully.')
  );
});

/**
 * 4. Approve or Reject an expense claim
 * PATCH /api/v1/expenses/:id/action
 */
export const reviewExpenseClaim = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;
  const { action, rejectionReason } = req.body; // action: "APPROVE" | "REJECT"

  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw new ApiError(400, 'Action must be either APPROVE or REJECT.');
  }

  const claim = await ExpenseClaim.findOne({ _id: id, companyId }).populate('employeeId');
  if (!claim) {
    throw new ApiError(404, 'Expense claim not found.');
  }

  if (claim.status !== 'PENDING') {
    throw new ApiError(400, `Cannot update claim. Current status is already ${claim.status}.`);
  }

  // SELF-APPROVAL GUARD: Block approver if the claim belongs to them
  const claimantUserId = claim.employeeId?.userId?.toString();
  const claimantEmail = claim.employeeId?.email;

  if (
    (claimantUserId && claimantUserId === req.user._id.toString()) ||
    (claimantEmail && claimantEmail.toLowerCase() === req.user.email?.toLowerCase())
  ) {
    throw new ApiError(403, 'Self-approval is blocked. You cannot approve or reject your own expense claim.');
  }

  if (action === 'APPROVE') {
    claim.status = 'APPROVED';
    claim.approvedBy = req.user._id;
    claim.actionDate = new Date();
    claim.rejectionReason = null;
  } else {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new ApiError(400, 'Rejection reason is required when rejecting a claim.');
    }
    claim.status = 'REJECTED';
    claim.approvedBy = req.user._id;
    claim.actionDate = new Date();
    claim.rejectionReason = rejectionReason.trim();
  }

  await claim.save();

  return res.status(200).json(
    new ApiResponse(200, claim, `Expense claim ${claim.status.toLowerCase()} successfully.`)
  );
});