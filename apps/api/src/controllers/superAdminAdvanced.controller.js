import mongoose from 'mongoose';
import { Plan } from '../models/plan.model.js';
import { BillingRecord } from '../models/billingRecord.model.js';
import { PlatformSupportTicket } from '../models/platformSupportTicket.model.js';
import { PlatformSetting } from '../models/platformSetting.model.js';
import { Company } from '../models/company.model.js';
import { Employee } from '../models/employee.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ==========================================
// 1. PLANS & SUBSCRIPTIONS
// ==========================================
export const getAllPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find().sort({ price: 1 });
  return res.status(200).json(new ApiResponse(200, plans, 'Plans retrieved successfully.'));
});

export const createPlan = asyncHandler(async (req, res) => {
  const { name, code, employeeLimit, price, currency, billingCycle, features } = req.body;
  if (!name || !code || !employeeLimit || price === undefined) {
    throw new ApiError(400, 'name, code, employeeLimit, and price are required.');
  }

  const existingPlan = await Plan.findOne({ $or: [{ name }, { code: code.toUpperCase() }] });
  if (existingPlan) {
    throw new ApiError(409, 'A plan with this name or code already exists.');
  }

  const plan = await Plan.create({
    name,
    code: code.toUpperCase(),
    employeeLimit,
    price,
    currency: currency || 'PKR',
    billingCycle: billingCycle || 'MONTHLY',
    features: features || [],
  });

  return res.status(201).json(new ApiResponse(201, plan, 'Plan created successfully.'));
});

export const updatePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const plan = await Plan.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!plan) throw new ApiError(404, 'Plan not found.');
  return res.status(200).json(new ApiResponse(200, plan, 'Plan updated successfully.'));
});

export const assignPlanToCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const { planId } = req.body;

  const [company, plan] = await Promise.all([
    Company.findById(companyId),
    Plan.findById(planId),
  ]);

  if (!company) throw new ApiError(404, 'Company not found.');
  if (!plan) throw new ApiError(404, 'Plan not found.');

  company.subscriptionPlan = plan.name;
  company.maxEmployees = plan.employeeLimit;
  await company.save();

  return res.status(200).json(
    new ApiResponse(200, { company, plan }, `Plan ${plan.name} assigned to company ${company.name}.`)
  );
});

// ==========================================
// 2. MANUAL BILLING
// ==========================================
export const getAllBillingRecords = asyncHandler(async (req, res) => {
  const { companyId, status } = req.query;
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (status) filter.status = status;

  const records = await BillingRecord.find(filter)
    .populate('companyId', 'name email')
    .populate('planId', 'name price currency')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, records, 'Billing records retrieved.'));
});

export const createBillingRecord = asyncHandler(async (req, res) => {
  const { companyId, planId, startDate, endDate, amount, currency, status, notes } = req.body;
  if (!companyId || !planId || !startDate || !endDate || amount === undefined) {
    throw new ApiError(400, 'companyId, planId, startDate, endDate, and amount are required.');
  }

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  const record = await BillingRecord.create({
    companyId,
    planId,
    billingPeriod: { startDate: new Date(startDate), endDate: new Date(endDate) },
    amount,
    currency: currency || 'PKR',
    status: status || 'PENDING',
    invoiceNumber,
    notes,
    recordedBy: req.user._id,
  });

  return res.status(201).json(new ApiResponse(201, record, 'Billing record created.'));
});

export const updateBillingRecordStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const record = await BillingRecord.findByIdAndUpdate(
    id,
    { status, ...(notes && { notes }) },
    { new: true, runValidators: true }
  );
  if (!record) throw new ApiError(404, 'Billing record not found.');

  return res.status(200).json(new ApiResponse(200, record, 'Billing record updated.'));
});

// ==========================================
// 3. PLATFORM ANALYTICS (AGGREGATION)
// ==========================================
export const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const [
    totalCompanies,
    activeCompanies,
    inactiveCompanies,
    totalEmployees,
    companiesByPlan,
    recentRegistrations,
  ] = await Promise.all([
    Company.countDocuments(),
    Company.countDocuments({ isActive: true }),
    Company.countDocuments({ isActive: false }),
    Employee.countDocuments(),
    Company.aggregate([
      { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } },
      { $project: { plan: { $ifNull: ['$_id', 'Unassigned'] }, count: 1, _id: 0 } },
    ]),
    Company.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
  ]);

  const analyticsData = {
    overview: {
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      totalEmployees,
    },
    companiesByPlan,
    growthOverTime: recentRegistrations.map((r) => ({
      period: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      companies: r.count,
    })),
  };

  return res.status(200).json(new ApiResponse(200, analyticsData, 'Platform analytics retrieved.'));
});

// ==========================================
// 4. AUDIT LOG VIEWER (READ-ONLY)
// ==========================================
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { companyId, actorId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (companyId) filter.companyId = companyId;
  if (actorId) filter.performedBy = actorId;
  if (action) filter.action = new RegExp(action, 'i');
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('companyId', 'name')
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { logs, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } },
      'Audit logs retrieved.'
    )
  );
});

// ==========================================
// 5. PLATFORM SUPPORT QUEUE
// ==========================================
export const getSupportTickets = asyncHandler(async (req, res) => {
  const { status, priority, companyId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (companyId) filter.companyId = companyId;

  const tickets = await PlatformSupportTicket.find(filter)
    .populate('companyId', 'name email')
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, tickets, 'Support tickets retrieved.'));
});

export const updateSupportTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, priority, adminNotes } = req.body;

  const updateData = {};
  if (status) {
    updateData.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }
  }
  if (priority) updateData.priority = priority;
  if (adminNotes) updateData.adminNotes = adminNotes;

  const ticket = await PlatformSupportTicket.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
  if (!ticket) throw new ApiError(404, 'Support ticket not found.');

  return res.status(200).json(new ApiResponse(200, ticket, 'Support ticket updated.'));
});

// ==========================================
// 6. SYSTEM SETTINGS & FEATURE FLAGS
// ==========================================
export const getPlatformSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSetting.find().sort({ key: 1 });
  return res.status(200).json(new ApiResponse(200, settings, 'Platform settings retrieved.'));
});

export const updatePlatformSetting = asyncHandler(async (req, res) => {
  const { key, value, description, isPublic } = req.body;
  if (!key || value === undefined) {
    throw new ApiError(400, 'Setting key and value are required.');
  }

  const setting = await PlatformSetting.findOneAndUpdate(
    { key },
    { key, value, ...(description && { description }), ...(isPublic !== undefined && { isPublic }) },
    { upsert: true, new: true }
  );

  return res.status(200).json(new ApiResponse(200, setting, 'Setting updated successfully.'));
});