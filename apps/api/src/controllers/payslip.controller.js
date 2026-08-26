import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Payslip } from '../models/payslip.model.js';
import { PayslipAdjustment } from '../models/payslipAdjustment.model.js';
import { PayslipPdfService } from '../services/payslipPdf.service.js';
import mongoose from 'mongoose';

export const createAdjustment = asyncHandler(async (req, res) => {
  const { payslipId, type, amount, reason } = req.body;

  if (!payslipId || !type || !amount || !reason) {
    throw new ApiError(400, 'payslipId, type, amount, and reason are mandatory.');
  }

  const adjustment = await PayslipAdjustment.create({
    companyId: req.user.companyId,
    payslipId,
    employeeId: req.body.employeeId,
    payrollRunId: req.body.payrollRunId,
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
  const result = await PayslipPdfService.generateAndUploadPayslip(payslipId);
  return res.status(200).json(new ApiResponse(200, result, 'Payslip PDF generated successfully.'));
});

export const getDownloadUrl = asyncHandler(async (req, res) => {
  const { payslipId } = req.params;
  const result = await PayslipPdfService.getDownloadUrl(payslipId, req.user);
  return res.status(200).json(new ApiResponse(200, result, 'Download URL generated.'));
});

export const updatePayslip = asyncHandler(async (req, res) => {
  const { payslipId } = req.params;

  const payslip = await Payslip.findById(payslipId);
  if (!payslip) {
    throw new ApiError(404, 'Payslip not found');
  }

  // Attempt to mutate fields (Pre-save hook will intercept if APPROVED/PAID)
  Object.assign(payslip, req.body);
  await payslip.save();

  return res
    .status(200)
    .json(new ApiResponse(200, payslip, 'Payslip updated successfully.'));
});