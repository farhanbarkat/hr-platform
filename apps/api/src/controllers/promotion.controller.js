import mongoose from 'mongoose';
import { PromotionRecord } from '../models/promotionRecord.model.js';
import { Employee } from '../models/employee.model.js';
import { SalaryStructure } from '../models/salaryStructure.model.js';
import { Department } from '../models/department.model.js';
import { LetterTemplateService } from '../services/letterTemplate.service.js';
import { NotificationService } from '../services/notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'HR', 'HR_MANAGER'];

const getEmployee = async (companyId, employeeId) => {
  const employee = await Employee.findOne({ _id: employeeId, companyId }).populate('departmentId', 'name');
  if (!employee) throw new ApiError(404, 'Employee not found in this company.');
  return employee;
};

const getUserEmployee = async (req) => {
  const employee = await Employee.findOne({
    companyId: req.companyId,
    $or: [{ userId: req.user._id }, { email: req.user.email }],
  });
  if (!employee) throw new ApiError(404, 'Employee profile not found.');
  return employee;
};

export const createPromotion = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { employeeId, newDesignation, newDepartmentId, effectiveDate, proposedSalary, justification } = req.body;
  if (!employeeId || !newDesignation || !effectiveDate || !proposedSalary?.baseSalary) {
    throw new ApiError(400, 'Employee, new designation, effective date, and proposed salary are required.');
  }

  const employee = await getEmployee(companyId, employeeId);
  const newDepartment = newDepartmentId ? await Department.findOne({ _id: newDepartmentId, companyId }) : null;
  if (newDepartmentId && !newDepartment) throw new ApiError(404, 'New department not found in this company.');
  const previousSalary = await SalaryStructure.findOne({ companyId, employeeId }).sort({ effectiveFrom: -1 });

  const record = await PromotionRecord.create({
    companyId,
    employeeId,
    previousDesignation: employee.designation || '',
    newDesignation: newDesignation.trim(),
    previousDepartmentId: employee.departmentId?._id || employee.departmentId || null,
    newDepartmentId: newDepartment?._id || null,
    previousSalaryStructureId: previousSalary?._id || null,
    proposedSalary,
    effectiveDate: new Date(effectiveDate),
    initiatedBy: req.user._id,
    justification: justification || '',
  });

  return res.status(201).json(new ApiResponse(201, record, 'Promotion proposal created.'));
});

export const listPromotions = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const filter = { companyId };
  if (req.query.status) filter.status = req.query.status;
  const records = await PromotionRecord.find(filter)
    .populate('employeeId', 'firstName lastName employeeId designation departmentId userId')
    .populate('initiatedBy', 'name email')
    .populate('approvedBy', 'name email')
    .populate('newDepartmentId', 'name code')
    .sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, records, 'Promotion records retrieved.'));
});

export const listEmployeePromotions = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const employee = await getEmployee(companyId, req.params.employeeId);
  const viewer = await getUserEmployee(req);
  const isAdmin = adminRoles.includes(String(req.user.role || '').toUpperCase());
  if (!isAdmin && viewer._id.toString() !== employee._id.toString()) throw new ApiError(403, 'You can only view your own promotion history.');
  const records = await PromotionRecord.find({ companyId, employeeId: employee._id })
    .populate('newDepartmentId', 'name code')
    .populate('initiatedBy', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ effectiveDate: -1, createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, records, 'Promotion history retrieved.'));
});

export const approvePromotion = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const record = await PromotionRecord.findOne({ _id: req.params.id, companyId }).populate('employeeId');
  if (!record) throw new ApiError(404, 'Promotion proposal not found.');
  if (record.status !== 'proposed') throw new ApiError(409, `Promotion is already ${record.status}.`);
  const targetUserId = record.employeeId.userId?.toString();
  if (targetUserId && targetUserId === req.user._id.toString()) throw new ApiError(403, 'Self-approval is blocked.');

  const employee = record.employeeId;
  const department = record.newDepartmentId ? await Department.findOne({ _id: record.newDepartmentId, companyId }) : null;
  const letter = await LetterTemplateService.generateLetterPdf({
    templateType: 'promotionLetter',
    companyId,
    employeeId: employee._id,
    generatedBy: req.user._id,
    dataContext: {
      employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      currentDesignation: record.previousDesignation,
      newDesignation: record.newDesignation,
      department: department?.name || employee.departmentId?.name || '',
      effectiveDate: new Date(record.effectiveDate).toLocaleDateString(),
      newCtc: `${record.proposedSalary.currency || 'PKR'} ${record.proposedSalary.grossSalary}`,
    },
  });

  record.status = 'offerSent';
  record.approvedBy = req.user._id;
  record.letterArtifactUrl = letter.fileUrl;
  record.letterHtmlContent = letter.html;
  await record.save();

  if (employee.userId) {
    await NotificationService.sendNotification({
      companyId,
      recipientId: employee.userId,
      title: 'Promotion offer is ready',
      message: `Your promotion to ${record.newDesignation} is ready for review and acceptance.`,
      category: 'SYSTEM',
      type: 'SUCCESS',
      data: { promotionId: record._id, action: 'PROMOTION_OFFER' },
      channels: ['IN_APP'],
    });
  }
  return res.status(200).json(new ApiResponse(200, record, 'Promotion approved and offer sent.'));
});

export const respondToPromotion = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { response, remarks = '' } = req.body;
  if (!['accept', 'decline'].includes(response)) throw new ApiError(400, 'Response must be accept or decline.');
  const employee = await getUserEmployee(req);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const record = await PromotionRecord.findOne({ _id: req.params.id, companyId, employeeId: employee._id }).session(session);
    if (!record) throw new ApiError(404, 'Promotion offer not found.');
    if (record.status !== 'offerSent') throw new ApiError(409, `Promotion offer is already ${record.status}.`);
    if (response === 'decline') {
      record.status = 'declined';
      record.employeeResponseDate = new Date();
      record.employeeRemarks = remarks;
      await record.save({ session });
      await session.commitTransaction();
      return res.status(200).json(new ApiResponse(200, record, 'Promotion offer declined.'));
    }

    const newSalary = await SalaryStructure.create([{
      companyId,
      employeeId: employee._id,
      effectiveFrom: record.effectiveDate,
      basicPay: record.proposedSalary.baseSalary,
      allowances: record.proposedSalary.allowances || [],
      salaryTypeId: record.proposedSalary.salaryTypeId || null,
      currency: record.proposedSalary.currency || 'PKR',
      createdBy: req.user._id,
      notes: `Created from promotion ${record._id}`,
    }], { session });
    await Employee.updateOne(
      { _id: employee._id, companyId },
      { $set: { designation: record.newDesignation, ...(record.newDepartmentId ? { departmentId: record.newDepartmentId } : {}) } },
      { session }
    );
    record.status = 'accepted';
    record.newSalaryStructureId = newSalary[0]._id;
    record.employeeResponseDate = new Date();
    record.employeeRemarks = remarks;
    await record.save({ session });
    await session.commitTransaction();
    return res.status(200).json(new ApiResponse(200, record, 'Promotion accepted and employee profile updated.'));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});
