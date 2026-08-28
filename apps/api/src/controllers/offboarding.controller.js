import crypto from 'crypto';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Offboarding } from '../models/offboarding.model.js';
import { ClearanceChecklistItem } from '../models/clearanceChecklist.model.js';
import { Employee } from '../models/employee.model.js';
import { User } from '../models/user.model.js';
import { SalaryStructure } from '../models/salaryStructure.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { LetterTemplateService } from '../services/letterTemplate.service.js';
import { NotificationService } from '../services/notification.service.js';

const DEFAULT_CHECKLIST_ITEMS = [
  { itemType: 'assetReturn', title: 'Laptop & Hardware Asset Handover', description: 'Return office laptop, security tokens, and monitor.' },
  { itemType: 'itAccessRevoked', title: 'IT & Cloud Access Revocation', description: 'Revoke AWS, GitHub, G-Suite, and VPN credentials.' },
  { itemType: 'financeClearance', title: 'Finance & Expense Clearances', description: 'Verify all pending petty cash and expense claims.' },
  { itemType: 'hrClearance', title: 'HR Exit Interview & ID Badge', description: 'Complete exit survey and surrender office physical ID.' },
];

/**
 * 1. Initiate Offboarding (Self-Resignation or HR-Termination)
 */
export const initiateOffboarding = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { employeeId, reason, lastWorkingDate, noticePeriodDays, exitInterviewNotes } = req.body;

  let targetEmployeeId = employeeId;

  // If initiated by employee via ESS
  if (req.user.role === 'EMPLOYEE' || req.user.role === 'employee') {
    targetEmployeeId = req.user.employeeId || req.user._id;
  }

  if (!targetEmployeeId) {
    throw new ApiError(400, 'Employee ID is required.');
  }

  const employee = await Employee.findOne({
    companyId,
    $or: [{ _id: targetEmployeeId }, { userId: targetEmployeeId }],
  });

  if (!employee) {
    throw new ApiError(404, 'Employee record not found in this organization.');
  }

  // Prevent multiple active offboarding cycles
  const activeOffboarding = await Offboarding.findOne({
    companyId,
    employeeId: employee._id,
    status: { $nin: ['exited', 'rejected'] },
  });

  if (activeOffboarding) {
    throw new ApiError(400, `An active offboarding cycle already exists (Status: ${activeOffboarding.status}).`);
  }

  const isSelf = req.user.role === 'EMPLOYEE' || req.user.role === 'employee';
  const calculatedNotice = Number(noticePeriodDays) || 30;

  let calculatedLWD = lastWorkingDate ? new Date(lastWorkingDate) : new Date();
  if (!lastWorkingDate) {
    calculatedLWD.setDate(calculatedLWD.getDate() + calculatedNotice);
  }

  const offboarding = await Offboarding.create({
    companyId,
    employeeId: employee._id,
    initiatedType: isSelf ? 'self-resignation' : 'hr-termination',
    initiatedBy: req.user._id,
    resignationDate: new Date(),
    lastWorkingDate: calculatedLWD,
    noticePeriodDays: calculatedNotice,
    reason: reason || (isSelf ? 'Voluntary Resignation' : 'Organizational Termination'),
    status: isSelf ? 'submitted' : 'acknowledged',
    exitInterviewNotes: exitInterviewNotes || '',
    acknowledgedBy: isSelf ? null : req.user._id,
    acknowledgedAt: isSelf ? null : new Date(),
  });

  // If HR initiates, generate checklist immediately
  if (!isSelf) {
    const checklistPayload = DEFAULT_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      companyId,
      offboardingId: offboarding._id,
      status: 'pending',
    }));
    await ClearanceChecklistItem.insertMany(checklistPayload);
    offboarding.status = 'clearanceInProgress';
    await offboarding.save();
  }

  return res.status(201).json(
    new ApiResponse(201, offboarding, 'Offboarding cycle initiated successfully.')
  );
});

/**
 * 2. HR Acknowledge Resignation & Spawn Clearance Checklist
 */
export const acknowledgeResignation = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { confirmedLastWorkingDate, remarks } = req.body;

  const offboarding = await Offboarding.findOne({ _id: id, companyId }).populate('employeeId');
  if (!offboarding) {
    throw new ApiError(404, 'Offboarding record not found.');
  }

  if (offboarding.status !== 'submitted') {
    throw new ApiError(400, `Cannot acknowledge offboarding in '${offboarding.status}' status.`);
  }

  if (confirmedLastWorkingDate) {
    offboarding.lastWorkingDate = new Date(confirmedLastWorkingDate);
  }

  offboarding.status = 'clearanceInProgress';
  offboarding.acknowledgedBy = req.user._id;
  offboarding.acknowledgedAt = new Date();

  // Generate Resignation Acceptance Letter (TICKET-022B1 Engine)
  try {
    const emp = offboarding.employeeId;
    const letter = await LetterTemplateService.generateLetterPdf({
      templateType: 'resignationAcceptance',
      companyId,
      employeeId: emp._id,
      generatedBy: req.user._id,
      dataContext: {
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        resignationDate: offboarding.resignationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        lastWorkingDate: offboarding.lastWorkingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      },
    });
    offboarding.resignationAcceptanceUrl = letter.fileUrl;
  } catch (err) {
    console.warn('[Offboarding] Resignation Acceptance Letter skipped/warning:', err.message);
  }

  await offboarding.save();

  // Auto-create clearance checklist
  const existingItems = await ClearanceChecklistItem.find({ offboardingId: offboarding._id });
  if (existingItems.length === 0) {
    const checklistPayload = DEFAULT_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      companyId,
      offboardingId: offboarding._id,
      status: 'pending',
    }));
    await ClearanceChecklistItem.insertMany(checklistPayload);
  }

  return res.status(200).json(
    new ApiResponse(200, offboarding, 'Resignation acknowledged, acceptance letter issued, and clearance initiated.')
  );
});

/**
 * 3. Update Checklist Item Status
 */
export const updateChecklistItem = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params; // checklist item ID
  const { status, remarks } = req.body;

  if (!['completed', 'waived', 'pending'].includes(status)) {
    throw new ApiError(400, "Invalid status. Must be 'completed', 'waived', or 'pending'.");
  }

  const item = await ClearanceChecklistItem.findOne({ _id: id, companyId });
  if (!item) {
    throw new ApiError(404, 'Clearance checklist item not found.');
  }

  item.status = status;
  item.completedBy = req.user._id;
  item.completedAt = status !== 'pending' ? new Date() : null;
  if (remarks) item.remarks = remarks;
  await item.save();

  // Check if all items in offboarding are completed/waived
  const pendingCount = await ClearanceChecklistItem.countDocuments({
    offboardingId: item.offboardingId,
    companyId,
    status: 'pending',
  });

  if (pendingCount === 0) {
    await Offboarding.findByIdAndUpdate(item.offboardingId, { status: 'cleared' });
  }

  return res.status(200).json(
    new ApiResponse(200, item, 'Checklist item updated successfully.')
  );
});

/**
 * 4. Trigger Final Settlement (Proration, Leave Encashment, Loans)
 */
export const processFinalSettlement = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { encashLeaves = true, encashmentRatePerDay = null, customDeductions = 0, remarks = '' } = req.body;

  const offboarding = await Offboarding.findOne({ _id: id, companyId }).populate('employeeId');
  if (!offboarding) {
    throw new ApiError(404, 'Offboarding record not found.');
  }

  if (!['clearanceInProgress', 'cleared'].includes(offboarding.status)) {
    throw new ApiError(400, `Cannot settle offboarding in '${offboarding.status}' status.`);
  }

  const employee = offboarding.employeeId;

  // Active Salary Structure
  const salaryStructure = await SalaryStructure.findOne({
    employeeId: employee._id,
    companyId,
    isActive: true,
  });

  const basicPay = Number(salaryStructure?.basicPay || 0);
  const grossSalary = Number(salaryStructure?.grossSalary || basicPay);

  // 1. Prorate Pay for Partial Final Month (TICKET-015 Math Logic)
  const lwd = new Date(offboarding.lastWorkingDate);
  const daysWorkedInFinalMonth = lwd.getDate();
  const totalDaysInFinalMonth = new Date(lwd.getFullYear(), lwd.getMonth() + 1, 0).getDate();

  const proratedFactor = Math.min(daysWorkedInFinalMonth / totalDaysInFinalMonth, 1);
  const proratedBasicPay = Math.round(basicPay * proratedFactor);
  const proratedGross = Math.round(grossSalary * proratedFactor);

  // 2. Leave Encashment Calculation
  let encashedLeavesCount = 0;
  let leaveEncashmentAmount = 0;

  if (encashLeaves) {
    const leaveBalances = await LeaveBalance.find({ employeeId: employee._id, companyId });
    encashedLeavesCount = leaveBalances.reduce((acc, curr) => acc + Math.max(Number(curr.remainingBalance || 0), 0), 0);

    const dailyRate = encashmentRatePerDay ? Number(encashmentRatePerDay) : Math.round(basicPay / 30);
    leaveEncashmentAmount = Math.round(encashedLeavesCount * dailyRate);
  }

  // 3. Outstanding Loan Check (Graceful Phase 3 Degradation)
  let outstandingLoanDeduction = 0;
  try {
    const LoanModel = mongoose.models.Loan;
    if (LoanModel) {
      const activeLoan = await LoanModel.findOne({
        employeeId: employee._id,
        companyId,
        status: 'ACTIVE',
      });
      if (activeLoan) {
        outstandingLoanDeduction = Number(activeLoan.remainingPrincipal || 0);
      }
    }
  } catch (err) {
    console.warn('[Offboarding] Loan model resolution skipped:', err.message);
  }

  const totalEarnings = proratedGross + leaveEncashmentAmount;
  const totalDeductions = outstandingLoanDeduction + Number(customDeductions || 0);
  const netSettlementAmount = totalEarnings - totalDeductions;
  const isNegativeBalance = netSettlementAmount < 0;

  offboarding.settlementDetails = {
    proratedBasicPay,
    proratedGrossSalary: proratedGross,
    encashedLeavesCount,
    leaveEncashmentAmount,
    outstandingLoanDeduction,
    totalDeductions,
    netSettlementAmount,
    isNegativeBalance,
    settledAt: new Date(),
    settledBy: req.user._id,
    remarks: remarks || (isNegativeBalance ? 'WARNING: Employee owes company balance!' : 'Settlement approved.'),
  };

  offboarding.status = 'settled';
  await offboarding.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      offboarding,
      isNegativeBalance
        ? 'Final settlement computed with NEGATIVE balance. Manual recovery required.'
        : 'Final settlement computed successfully.'
    )
  );
});

/**
 * 5. Finalize Exit, Generate Letters, Deactivate Login & Create Secure Link
 */
export const completeExit = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const offboarding = await Offboarding.findOne({ _id: id, companyId }).populate('employeeId');
  if (!offboarding) {
    throw new ApiError(404, 'Offboarding record not found.');
  }

  if (!['settled', 'cleared'].includes(offboarding.status)) {
    throw new ApiError(400, `Cannot complete exit while status is '${offboarding.status}'. Settlement is required.`);
  }

  const employee = offboarding.employeeId;

  // Generate Relieving Letter & Experience Letter (TICKET-022B1 Engine)
  const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  const joiningDateStr = employee.dateOfJoining
    ? new Date(employee.dateOfJoining).toLocaleDateString('en-US', dateOptions)
    : 'Date of Joining';
  const lwdStr = new Date(offboarding.lastWorkingDate).toLocaleDateString('en-US', dateOptions);

  try {
    const relieving = await LetterTemplateService.generateLetterPdf({
      templateType: 'relievingLetter',
      companyId,
      employeeId: employee._id,
      generatedBy: req.user._id,
      dataContext: {
        employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        designation: employee.designation || 'Software Engineer',
        lastWorkingDate: lwdStr,
      },
    });
    offboarding.relievingLetterUrl = relieving.fileUrl;
  } catch (err) {
    console.warn('[Offboarding] Relieving letter generation fallback:', err.message);
  }

  try {
    const experience = await LetterTemplateService.generateLetterPdf({
      templateType: 'experienceLetter',
      companyId,
      employeeId: employee._id,
      generatedBy: req.user._id,
      dataContext: {
        employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        designation: employee.designation || 'Software Engineer',
        joiningDate: joiningDateStr,
        relievingDate: lwdStr,
      },
    });
    offboarding.experienceLetterUrl = experience.fileUrl;
  } catch (err) {
    console.warn('[Offboarding] Experience letter generation fallback:', err.message);
  }

  // Generate 90-day time-limited secure token for exited employee letter downloads
  const secureToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + 90);

  offboarding.secureAccessToken = secureToken;
  offboarding.secureTokenExpiresAt = tokenExpiry;
  offboarding.status = 'exited';
  await offboarding.save();

  // Update Employee Status to 'exited'
  await Employee.findByIdAndUpdate(employee._id, {
    employmentStatus: 'exited',
    status: 'inactive',
    isActive: false,
  });

  // Deactivate User Login
  if (employee.userId) {
    await User.findByIdAndUpdate(employee.userId, {
      isActive: false,
      status: 'inactive',
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        offboarding,
        downloadPortalUrl: `/api/v1/offboarding/secure-access/${secureToken}`,
      },
      'Employee exit completed. User login deactivated, employmentStatus set to exited, and letters published.'
    )
  );
});

/**
 * 6. Secure Access Link for Exited Employees (No login required)
 */
export const getExitedEmployeeLetters = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const offboarding = await Offboarding.findOne({
    secureAccessToken: token,
    secureTokenExpiresAt: { $gt: new Date() },
  }).populate('employeeId', 'firstName lastName designation employeeId');

  if (!offboarding) {
    throw new ApiError(403, 'Secure access link is invalid or expired.');
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        employee: offboarding.employeeId,
        resignationAcceptanceUrl: offboarding.resignationAcceptanceUrl,
        relievingLetterUrl: offboarding.relievingLetterUrl,
        experienceLetterUrl: offboarding.experienceLetterUrl,
        settlementDetails: offboarding.settlementDetails,
      },
      'Exit documentation access granted.'
    )
  );
});

/**
 * 7. Query Offboarding Records (HR & Profile History)
 */
export const getCompanyOffboardings = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { status, employeeId } = req.query;

  const query = { companyId };
  if (status) query.status = status;
  if (employeeId) query.employeeId = employeeId;

  const offboardings = await Offboarding.find(query)
    .populate('employeeId', 'firstName lastName employeeId designation email employmentStatus')
    .populate('initiatedBy', 'email role')
    .populate('acknowledgedBy', 'email role')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, { offboardings }, 'Offboarding records retrieved.')
  );
});

/**
 * 8. Get Clearance Checklist Details
 */
export const getOffboardingChecklist = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const items = await ClearanceChecklistItem.find({ offboardingId: id, companyId })
    .populate('completedBy', 'email role')
    .sort({ createdAt: 1 });

  return res.status(200).json(
    new ApiResponse(200, { checklist: items }, 'Clearance checklist items retrieved.')
  );
});