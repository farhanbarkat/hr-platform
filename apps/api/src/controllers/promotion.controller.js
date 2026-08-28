import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { PromotionRecord } from '../models/promotionRecord.model.js';
import { Employee } from '../models/employee.model.js';
import { Department } from '../models/department.model.js';
import { SalaryStructure } from '../models/salaryStructure.model.js';
import { LetterTemplateService } from '../services/letterTemplate.service.js';
import { NotificationService } from '../services/notification.service.js';

/**
 * 1. Propose Promotion (HR / Manager)
 */
export const proposePromotion = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const {
    employeeId,
    newDesignation,
    newDepartmentId,
    proposedSalary,
    effectiveDate,
    justification,
  } = req.body;

  if (!employeeId || !newDesignation || !effectiveDate || !proposedSalary?.baseSalary) {
    throw new ApiError(400, 'Employee, new designation, effective date, and salary details are required.');
  }

  const employee = await Employee.findOne({
    companyId,
    $or: [{ _id: employeeId }, { userId: employeeId }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee not found in this organization.');
  }

  // Self-action check
  if (req.user?.employeeId && req.user.employeeId.toString() === employee._id.toString()) {
    throw new ApiError(403, 'Self-action restriction: You cannot propose your own promotion.');
  }

  // Get current active salary structure
  const currentSalary = await SalaryStructure.findOne({
    employeeId: employee._id,
    companyId,
    isActive: true,
  }).sort({ version: -1 });

  // Calculate gross and net
  const allowancesTotal = (proposedSalary.allowances || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const deductionsTotal = (proposedSalary.deductions || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const grossSalary = Number(proposedSalary.baseSalary) + allowancesTotal;
  const netSalary = grossSalary - deductionsTotal;

  const promotion = await PromotionRecord.create({
    companyId,
    employeeId: employee._id,
    previousDesignation: employee.designation || 'N/A',
    newDesignation: newDesignation.trim(),
    previousDepartmentId: employee.departmentId || null,
    newDepartmentId: newDepartmentId || employee.departmentId || null,
    previousSalaryStructureId: currentSalary?._id || null,
    proposedSalary: {
      baseSalary: Number(proposedSalary.baseSalary),
      allowances: proposedSalary.allowances || [],
      deductions: proposedSalary.deductions || [],
      grossSalary,
      netSalary,
      currency: proposedSalary.currency || 'PKR',
    },
    effectiveDate: new Date(effectiveDate),
    justification: justification || '',
    initiatedBy: req.user._id,
    status: 'proposed',
  });

  return res.status(201).json(
    new ApiResponse(201, promotion, 'Promotion proposed successfully and queued for approval.')
  );
});

/**
 * 2. Approve Proposal & Generate Offer Letter (HR / Company Admin)
 */
export const approvePromotion = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const promotion = await PromotionRecord.findOne({ _id: id, companyId });

  if (!promotion) {
    throw new ApiError(404, 'Promotion record not found.');
  }

  if (promotion.status !== 'proposed') {
    throw new ApiError(400, `Cannot approve promotion with current status: ${promotion.status}`);
  }

  // Safe Self-approval restriction guard
  if (req.user?.employeeId && req.user.employeeId.toString() === promotion.employeeId.toString()) {
    throw new ApiError(403, 'Self-approval violation: You cannot approve your own promotion.');
  }

  const employee = await Employee.findById(promotion.employeeId);
  const department = promotion.newDepartmentId ? await Department.findById(promotion.newDepartmentId) : null;
  const departmentName = department?.name || 'Engineering';

  // Format currency
  const newCtcFormatted = `${promotion.proposedSalary?.currency || 'PKR'} ${((promotion.proposedSalary?.grossSalary || 0) * 12).toLocaleString()}`;

  // Call shared letter generator (TICKET-022B1)
  const letterResult = await LetterTemplateService.generateLetterPdf({
    templateType: 'promotionLetter',
    companyId,
    employeeId: employee?._id || promotion.employeeId,
    generatedBy: req.user._id,
    dataContext: {
      employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'Valued Employee',
      currentDesignation: promotion.previousDesignation,
      newDesignation: promotion.newDesignation,
      department: departmentName,
      effectiveDate: promotion.effectiveDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      newCtc: newCtcFormatted,
    },
  });

  promotion.status = 'offerSent';
  promotion.approvedBy = req.user._id;
  promotion.letterArtifactUrl = letterResult.fileUrl;
  promotion.letterHtmlContent = letterResult.html;
  await promotion.save();

  // Safe Notification Dispatch
  try {
    const recipient = employee?.userId || employee?._id || promotion.employeeId;
    if (recipient) {
      await NotificationService.sendNotification({
        companyId,
        recipientId: recipient,
        title: 'Promotion Offer Letter Issued',
        message: `Congratulations! A promotion offer to ${promotion.newDesignation} has been approved and issued. Please review and acknowledge in ESS.`,
        type: 'SUCCESS',
        category: 'SYSTEM',
        metadata: { promotionId: promotion._id, letterUrl: letterResult.fileUrl },
      });
    }
  } catch (notifErr) {
    console.warn('[Promotion] Notification dispatch warning:', notifErr.message);
  }

  return res.status(200).json(
    new ApiResponse(200, promotion, 'Promotion approved and official offer letter generated.')
  );
});

/**
 * 3. Employee Response (Accept / Decline via ESS with Transaction Integrity)
 */
export const respondToPromotionOffer = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { action, remarks } = req.body;

  if (!['accepted', 'declined'].includes(action)) {
    throw new ApiError(400, "Invalid action. Must be 'accepted' or 'declined'.");
  }

  const promotion = await PromotionRecord.findOne({ _id: id, companyId });
  if (!promotion) {
    throw new ApiError(404, 'Promotion record not found.');
  }

  if (promotion.status !== 'offerSent') {
    throw new ApiError(400, `Cannot respond to promotion with status: ${promotion.status}`);
  }

  // Ensure only targeted employee or linked user can respond
  const employee = await Employee.findById(promotion.employeeId);
  const currentUserId = req.user._id.toString();
  const currentEmpId = req.user.employeeId ? req.user.employeeId.toString() : null;

  const isAuthorized =
    (currentEmpId && currentEmpId === promotion.employeeId.toString()) ||
    (employee?.userId && employee.userId.toString() === currentUserId) ||
    promotion.employeeId.toString() === currentUserId;

  if (!isAuthorized) {
    throw new ApiError(403, 'Unauthorized: You can only respond to your own promotion offer.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (action === 'accepted') {
      // 1. Versioned SalaryStructure creation (TICKET-014 Compliance)
      const latestSalary = await SalaryStructure.findOne({
        employeeId: promotion.employeeId,
        companyId,
      })
        .sort({ version: -1 })
        .session(session);

      const newVersionNumber = latestSalary ? latestSalary.version + 1 : 1;

      // Deactivate previous active versions
      await SalaryStructure.updateMany(
        { employeeId: promotion.employeeId, companyId, isActive: true },
        { $set: { isActive: false } },
        { session }
      );

      const [newSalaryStructure] = await SalaryStructure.create(
        [
          {
            companyId,
            employeeId: promotion.employeeId,
            basicPay: promotion.proposedSalary.baseSalary,
            allowances: promotion.proposedSalary.allowances || [],
            deductions: promotion.proposedSalary.deductions || [],
            grossSalary: promotion.proposedSalary.grossSalary,
            netSalary: promotion.proposedSalary.netSalary,
            currency: promotion.proposedSalary.currency || 'PKR',
            version: newVersionNumber,
            effectiveDate: promotion.effectiveDate,
            effectiveFrom: promotion.effectiveDate,
            isActive: true,
            createdBy: promotion.approvedBy || req.user._id,
            updatedBy: req.user._id,
          },
        ],
        { session }
      );

      // 2. Update Employee Master Record
      const updatePayload = { designation: promotion.newDesignation };
      if (promotion.newDepartmentId) {
        updatePayload.departmentId = promotion.newDepartmentId;
      }
      await Employee.findByIdAndUpdate(promotion.employeeId, updatePayload, { session });

      // 3. Mark Promotion Record accepted
      promotion.status = 'accepted';
      promotion.newSalaryStructureId = newSalaryStructure._id;
    } else {
      promotion.status = 'declined';
    }

    promotion.employeeResponseDate = new Date();
    promotion.employeeRemarks = remarks || '';
    await promotion.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(
      new ApiResponse(
        200,
        promotion,
        action === 'accepted'
          ? 'Promotion accepted. Employee profile and salary structure versioned successfully.'
          : 'Promotion offer declined.'
      )
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

/**
 * 4. List Company Promotions (HR / Admin)
 */
export const getCompanyPromotions = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { status, employeeId } = req.query;

  const query = { companyId };
  if (status) query.status = status;
  if (employeeId) query.employeeId = employeeId;

  const promotions = await PromotionRecord.find(query)
    .populate('employeeId', 'firstName lastName designation email')
    .populate('previousDepartmentId', 'name')
    .populate('newDepartmentId', 'name')
    .populate('initiatedBy', 'email role')
    .populate('approvedBy', 'email role')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, { promotions }, 'Promotions retrieved successfully.')
  );
});

/**
 * 5. Get Employee Promotion & Career History
 */
export const getEmployeePromotionHistory = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { employeeId } = req.params;

  const history = await PromotionRecord.find({ companyId, employeeId })
    .populate('previousDepartmentId', 'name')
    .populate('newDepartmentId', 'name')
    .populate('approvedBy', 'email')
    .populate('newSalaryStructureId', 'version basicPay grossSalary netSalary')
    .sort({ effectiveDate: -1, createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, { history }, 'Employee career and promotion timeline retrieved.')
  );
});

/**
 * 6. Get My Promotion Offers (ESS)
 */
export const getMyPromotions = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const employeeId = req.user?.employeeId;

  const query = { companyId };
  if (employeeId) {
    query.employeeId = employeeId;
  } else {
    query.employeeId = req.user._id;
  }

  const promotions = await PromotionRecord.find(query)
    .populate('previousDepartmentId', 'name')
    .populate('newDepartmentId', 'name')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, { promotions }, 'My promotion records retrieved.')
  );
});