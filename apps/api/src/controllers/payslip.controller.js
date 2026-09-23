import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Payslip } from '../models/payslip.model.js';
import { PayslipAdjustment } from '../models/payslipAdjustment.model.js';
import { PayslipPdfService } from '../services/payslipPdf.service.js';
import mongoose from 'mongoose';

export const createAdjustment = asyncHandler(async (req, res) => {
  const { payslipId, type, amount, reason } = req.body;

  if (!payslipId || !type || amount === undefined || !reason) {
    throw new ApiError(400, 'payslipId, type, amount, and reason are mandatory.');
  }
  if (!mongoose.Types.ObjectId.isValid(payslipId)) {
    throw new ApiError(400, 'Invalid payslip ID.');
  }

  const payslip = await Payslip.findOne({ _id: payslipId, companyId: req.companyId })
    .select('employeeId payrollRunId');
  if (!payslip) {
    throw new ApiError(404, 'Payslip not found.');
  }

  const adjustment = await PayslipAdjustment.create({
    companyId: req.companyId,
    payslipId,
    employeeId: payslip.employeeId,
    payrollRunId: payslip.payrollRunId,
    type,
    amount: mongoose.Types.Decimal128.fromString(amount.toString()),
    reason,
    createdBy: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, adjustment, 'Payslip post-approval adjustment logged successfully.'));
});

export const generatePdf = asyncHandler(async (req, res) => {
  const { payslipId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(payslipId)) {
    throw new ApiError(400, 'Invalid payslip ID.');
  }
  const result = await PayslipPdfService.generateAndUploadPayslip(payslipId, req.companyId);
  return res.status(200).json(new ApiResponse(200, result, 'Payslip PDF generated successfully.'));
});

export const getDownloadUrl = asyncHandler(async (req, res) => {
  const { payslipId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(payslipId)) {
    throw new ApiError(400, 'Invalid payslip ID.');
  }
  const result = await PayslipPdfService.getDownloadUrl(payslipId, req.user, req.companyId);
  return res.status(200).json(new ApiResponse(200, result, 'Download URL generated.'));
});

export const updatePayslip = asyncHandler(async (req, res) => {
  const { payslipId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(payslipId)) {
    throw new ApiError(400, 'Invalid payslip ID.');
  }

  const payslip = await Payslip.findOne({ _id: payslipId, companyId: req.companyId });
  if (!payslip) {
    throw new ApiError(404, 'Payslip not found');
  }

  const allowedFields = ['earnings', 'deductions', 'netPay', 'attendanceSummary', 'status'];
  const updateFields = Object.fromEntries(
    Object.entries(req.body || {}).filter(([field]) => allowedFields.includes(field))
  );
  if (Object.keys(updateFields).length === 0) {
    throw new ApiError(400, 'At least one valid payslip field is required.');
  }

  Object.assign(payslip, updateFields);
  await payslip.save();

  return res
    .status(200)
    .json(new ApiResponse(200, payslip, 'Payslip updated successfully.'));
});