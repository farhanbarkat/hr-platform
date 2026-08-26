import { v4 as uuidv4 } from 'uuid';
import { Document } from '../models/document.model.js';
import { Employee } from '../models/employee.model.js';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  checkS3ObjectExists,
} from '../utils/s3.js';
import { scanUploadedFile } from '../services/scanner.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Generate Pre-signed Upload URL
 * @route   POST /api/v1/documents/upload-url
 */
export const getUploadUrl = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { employeeId, fileName, fileType, documentType } = req.body;

  if (!employeeId || !fileName || !fileType || !documentType) {
    throw new ApiError(400, 'employeeId, fileName, fileType, and documentType are required.');
  }

  // Verify employee exists in current company
  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) {
    throw new ApiError(404, 'Employee not found in your company.');
  }

  // RBAC: If standard EMPLOYEE, ensure they only upload for themselves
  if (req.user.role === 'EMPLOYEE') {
    const isSelf = employee.userId?.toString() === req.user._id.toString() ||
                   employee.email.toLowerCase() === req.user.email.toLowerCase();
    if (!isSelf) {
      throw new ApiError(403, 'Employees can only upload documents for their own profile.');
    }
  }

  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = uuidv4();
  const s3Key = `companies/${companyId}/employees/${employeeId}/documents/${uniquePrefix}-${sanitizedFileName}`;

  const uploadUrl = await generatePresignedUploadUrl(s3Key, fileType);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        uploadUrl,
        s3Key,
        expiresIn: 900,
      },
      'Pre-signed upload URL generated successfully.'
    )
  );
});

/**
 * @desc    Confirm Upload, Scan & Save Metadata
 * @route   POST /api/v1/documents
 */
export const confirmUpload = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const {
    employeeId,
    documentType,
    fileName,
    mimeType,
    s3Key,
    expiryDate,
  } = req.body;

  if (!employeeId || !documentType || !fileName || !mimeType || !s3Key) {
    throw new ApiError(400, 'Missing mandatory document metadata.');
  }

  // Enforce path scoping integrity
  const expectedPrefix = `companies/${companyId}/employees/${employeeId}/documents/`;
  if (!s3Key.startsWith(expectedPrefix)) {
    throw new ApiError(403, 'Invalid S3 key scoping. File path violates tenant boundary.');
  }

  // 1. Run Malware Scan
  const scanResult = await scanUploadedFile(s3Key, fileName);
  const status = scanResult.isClean ? 'AVAILABLE' : 'QUARANTINED';

  // 2. Check S3 object metadata
  const objectMeta = await checkS3ObjectExists(s3Key);

  // 3. Create Document Record
  const document = await Document.create({
    companyId,
    employeeId,
    documentType,
    fileName,
    fileSize: objectMeta.size || 0,
    mimeType,
    s3Key,
    uploadedBy: req.user._id,
    status,
    scanResult,
    expiryDate: expiryDate || null,
  });

  if (status === 'QUARANTINED') {
    return res.status(422).json(
      new ApiResponse(
        422,
        document,
        'File failed the security/malware scan and has been quarantined.'
      )
    );
  }

  return res.status(201).json(
    new ApiResponse(201, document, 'Document upload confirmed and verified.')
  );
});

/**
 * @desc    Get Pre-signed Download URL (Authorized HR/Admin or Owning Employee)
 * @route   GET /api/v1/documents/:id/download-url
 */
export const getDownloadUrl = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { id } = req.params;

  const document = await Document.findOne({ _id: id, companyId });
  if (!document) {
    throw new ApiError(404, 'Document not found.');
  }

  if (document.status === 'QUARANTINED') {
    throw new ApiError(403, 'Access denied: This file has been quarantined due to failed security checks.');
  }

  if (document.status !== 'AVAILABLE') {
    throw new ApiError(400, 'This file is still processing scan verification.');
  }

  // Access Control: Allow Admin/HR or Owning Employee
  if (req.user.role === 'EMPLOYEE') {
    const employee = await Employee.findOne({ _id: document.employeeId, companyId });
    const isSelf = employee && (
      employee.userId?.toString() === req.user._id.toString() ||
      employee.email.toLowerCase() === req.user.email.toLowerCase()
    );

    if (!isSelf) {
      throw new ApiError(403, 'Access denied: You do not have permission to download this document.');
    }
  }

  const downloadUrl = await generatePresignedDownloadUrl(document.s3Key, document.fileName);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        downloadUrl,
        expiresIn: 300,
        fileName: document.fileName,
      },
      'Pre-signed download URL generated successfully.'
    )
  );
});

/**
 * @desc    List Documents for an Employee
 * @route   GET /api/v1/documents/employee/:employeeId
 */
export const getEmployeeDocuments = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { employeeId } = req.params;

  // Authorization check for employees
  if (req.user.role === 'EMPLOYEE') {
    const employee = await Employee.findOne({ _id: employeeId, companyId });
    const isSelf = employee && (
      employee.userId?.toString() === req.user._id.toString() ||
      employee.email.toLowerCase() === req.user.email.toLowerCase()
    );

    if (!isSelf) {
      throw new ApiError(403, 'Access denied: You can only view your own documents.');
    }
  }

  const documents = await Document.find({ companyId, employeeId })
    .populate('uploadedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, documents, 'Documents retrieved successfully.')
  );
});

/**
 * @desc    Get Expiring Documents (HR/Admin feature for notifications)
 * @route   GET /api/v1/documents/expiring
 */
export const getExpiringDocuments = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;
  const { days = 30 } = req.query;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Number(days));

  const expiringDocuments = await Document.find({
    companyId,
    status: 'AVAILABLE',
    expiryDate: { $gte: new Date(), $lte: targetDate },
  })
    .populate('employeeId', 'firstName lastName employeeId email department')
    .sort({ expiryDate: 1 });

  return res.status(200).json(
    new ApiResponse(200, expiringDocuments, `Documents expiring within ${days} days retrieved.`)
  );
});