import fs from 'fs';
import path from 'path';
import { TaxCertificate } from '../models/taxCertificate.model.js';
import { User } from '../models/user.model.js';
import { taxCertificateQueue } from '../queues/taxCertificate.queue.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Queue Background Tax Certificate Generation (On Demand / Batch)
 * POST /api/v1/tax-certificates/generate
 */
export const requestTaxCertificate = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { employeeId, taxYear } = req.body;

  // Resolve target employee ID: Body -> Session -> DB User Doc lookup
  let targetEmployeeId = employeeId || req.user?.employeeId;
  if (!targetEmployeeId && req.user?._id) {
    const userDoc = await User.findById(req.user._id).select('employeeId');
    targetEmployeeId = userDoc?.employeeId;
  }

  if (!targetEmployeeId) {
    throw new ApiError(400, 'Target employeeId is required.');
  }

  // Authorization Guard: Regular employees can only request their own certificate
  const isPrivileged = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(req.user?.role);
  const currentEmpId = req.user?.employeeId ? req.user.employeeId.toString() : null;

  if (!isPrivileged && currentEmpId && currentEmpId !== targetEmployeeId.toString()) {
    throw new ApiError(403, 'Forbidden: You can only request your own tax certificate.');
  }

  const selectedTaxYear = taxYear || '2026-2027';

  // Upsert pending certificate record
  let certDoc = await TaxCertificate.findOne({
    companyId,
    employeeId: targetEmployeeId,
    taxYear: selectedTaxYear,
  });

  if (!certDoc) {
    certDoc = await TaxCertificate.create({
      companyId,
      employeeId: targetEmployeeId,
      taxYear: selectedTaxYear,
      status: 'PENDING',
      requestedBy: req.user._id,
    });
  } else {
    certDoc.status = 'PENDING';
    certDoc.errorMessage = null;
    await certDoc.save();
  }

  // Add Background Job to BullMQ (Acceptance Criteria #1)
  const job = await taxCertificateQueue.add('generateAnnualCertificate', {
    certificateId: certDoc._id.toString(),
    companyId: companyId.toString(),
    employeeId: targetEmployeeId.toString(),
    taxYear: selectedTaxYear,
    requestedBy: req.user._id.toString(),
  });

  certDoc.jobId = job.id;
  await certDoc.save();

  return res.status(202).json(
    new ApiResponse(
      202,
      {
        certificateId: certDoc._id,
        status: certDoc.status,
        jobId: job.id,
        taxYear: certDoc.taxYear,
      },
      'Tax certificate generation queued in background.'
    )
  );
});

/**
 * 2. Get Employee Certificates / List
 * GET /api/v1/tax-certificates
 */
export const getTaxCertificates = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { employeeId, taxYear } = req.query;

  const isPrivileged = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(req.user?.role);
  const query = { companyId };

  if (!isPrivileged) {
    let empId = req.user?.employeeId;
    if (!empId && req.user?._id) {
      const userDoc = await User.findById(req.user._id).select('employeeId');
      empId = userDoc?.employeeId;
    }
    if (empId) {
      query.employeeId = empId;
    }
  } else if (employeeId) {
    query.employeeId = employeeId;
  }

  if (taxYear) query.taxYear = taxYear;

  const certificates = await TaxCertificate.find(query)
    .populate('employeeId', 'firstName lastName employeeId designation')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, certificates, 'Tax certificates retrieved successfully.')
  );
});

/**
 * 3. Secure Download / Stream Certificate PDF
 * GET /api/v1/tax-certificates/:id/download
 */
export const downloadTaxCertificate = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const certDoc = await TaxCertificate.findOne({ _id: id, companyId }).populate('employeeId');
  if (!certDoc) {
    throw new ApiError(404, 'Tax certificate not found.');
  }

  // 1. Authorization / Ownership Guard (Must run FIRST)
  const isPrivileged = ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(req.user?.role);
  let userEmpId = req.user?.employeeId ? req.user.employeeId.toString() : null;

  if (!userEmpId && req.user?._id) {
    const userDoc = await User.findById(req.user._id).select('employeeId');
    userEmpId = userDoc?.employeeId ? userDoc.employeeId.toString() : null;
  }

  const certEmpId = certDoc.employeeId?._id
    ? certDoc.employeeId._id.toString()
    : certDoc.employeeId?.toString();

  if (!isPrivileged && userEmpId !== certEmpId) {
    throw new ApiError(403, 'Forbidden: You do not have permission to download this tax certificate.');
  }

  // 2. Status Check (Only runs if user is authorized)
  if (certDoc.status !== 'COMPLETED' || !certDoc.s3Key) {
    throw new ApiError(400, `Certificate is not ready for download (Status: ${certDoc.status}).`);
  }

  // 3. Stream File
  const localFilePath = path.resolve(process.cwd(), 'public/uploads', certDoc.s3Key);
  if (fs.existsSync(localFilePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${certDoc.certificateNumber || 'tax-certificate'}.pdf"`
    );
    return fs.createReadStream(localFilePath).pipe(res);
  }

  return res.redirect(certDoc.s3Url);
});