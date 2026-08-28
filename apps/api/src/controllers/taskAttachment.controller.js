import { TaskAttachment } from '../models/taskAttachment.model.js';
import { Task } from '../models/task.model.js';
import { Employee } from '../models/employee.model.js';
import { CustomRole } from '../models/customRole.model.js';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  deleteS3Object,
} from '../utils/s3.js';
import crypto from 'crypto';

/**
 * Determine high-level fileType from MIME type
 */
const resolveFileType = (mimeType = '') => {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('text') ||
    mimeType.includes('zip')
  ) {
    return 'DOCUMENT';
  }
  return 'OTHER';
};

/**
 * Dynamically resolves user's effective permissions (Base Role + Custom Role)
 */
const getUserPermissions = async (user, companyId) => {
  let permissions = new Set(DEFAULT_ROLE_PERMISSIONS[user.role] || []);

  // 1. Check direct User customRoleId
  if (user.customRoleId) {
    const customRole = await CustomRole.findOne({ _id: user.customRoleId, companyId });
    if (customRole && Array.isArray(customRole.permissions)) {
      customRole.permissions.forEach((perm) => permissions.add(perm));
    }
  }

  // 2. Check linked Employee profile customRoleId
  const employee = await Employee.findOne({
    companyId,
    $or: [{ userId: user._id }, { email: user.email }],
  });

  if (
    employee?.customRoleId &&
    (!user.customRoleId || employee.customRoleId.toString() !== user.customRoleId.toString())
  ) {
    const empCustomRole = await CustomRole.findOne({ _id: employee.customRoleId, companyId });
    if (empCustomRole && Array.isArray(empCustomRole.permissions)) {
      empCustomRole.permissions.forEach((perm) => permissions.add(perm));
    }
  }

  return { permissions, employee };
};

/**
 * Validates task access dynamically:
 * - Admins/HR & Project Managers (with task.manage_boards) have broad access.
 * - Standard Employees / Peers MUST be assigned to the task (Creator, Assignee, Collaborator).
 */
const assertTaskAccess = async (taskId, companyId, user) => {
  const task = await Task.findOne({ _id: taskId, companyId });
  if (!task) {
    throw new ApiError(404, 'Task not found.');
  }

  // 1. Super Admin, Company Admin, and HR have company-wide access
  if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR'].includes(user.role)) {
    return task;
  }

  // 2. Resolve Dynamic Permissions (Custom Role / Base Role)
  const { permissions, employee } = await getUserPermissions(user, companyId);

  // Only Board Managers / Task Admins can bypass individual task membership
  const hasManagementPrivilege =
    permissions.has(PERMISSIONS.TASK?.MANAGE_BOARDS || 'task.manage_boards') ||
    permissions.has('task.manage_all');

  if (hasManagementPrivilege) {
    return task;
  }

  // 3. Strict Task Membership Check for regular employees / peers
  const employeeIdStr = employee?._id?.toString();
  const userIdStr = user._id?.toString();

  const isCreator =
    (task.assignedBy && (task.assignedBy.toString() === userIdStr || task.assignedBy.toString() === employeeIdStr)) ||
    (task.creatorId && (task.creatorId.toString() === userIdStr || task.creatorId.toString() === employeeIdStr));

  const isAssignee =
    (task.assignedTo && (task.assignedTo.toString() === userIdStr || task.assignedTo.toString() === employeeIdStr)) ||
    (task.assigneeId && (task.assigneeId.toString() === userIdStr || task.assigneeId.toString() === employeeIdStr));

  const isCollaborator =
    (Array.isArray(task.collaborators) &&
      task.collaborators.some((id) => id && (id.toString() === userIdStr || id.toString() === employeeIdStr))) ||
    (Array.isArray(task.assignees) &&
      task.assignees.some((id) => id && (id.toString() === userIdStr || id.toString() === employeeIdStr)));

  if (!isCreator && !isAssignee && !isCollaborator) {
    throw new ApiError(
      403,
      'Access denied: You do not have permission to view or modify attachments on this task.'
    );
  }

  return task;
};

/**
 * 1. Get Pre-signed S3 Upload URL
 * POST /api/v1/task-attachments/presigned-upload
 */
export const getPresignedUploadUrl = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { taskId, fileName, mimeType, fileSizeBytes } = req.body;

  if (!taskId || !fileName || !mimeType) {
    throw new ApiError(400, 'Task ID, file name, and MIME type are required.');
  }

  // Validate task membership / custom role access
  await assertTaskAccess(taskId, companyId, req.user);

  const fileExt = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
  const randomHash = crypto.randomBytes(8).toString('hex');
  const s3Key = `companies/${companyId}/tasks/${taskId}/attachments/${Date.now()}-${randomHash}.${fileExt}`;

  const uploadUrl = await generatePresignedUploadUrl(s3Key, mimeType, 900);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        uploadUrl,
        s3Key,
        fileType: resolveFileType(mimeType),
      },
      'Pre-signed S3 upload URL generated successfully.'
    )
  );
});

/**
 * 2. Save Attachment Record in Mongo (Referenced Collection)
 * POST /api/v1/task-attachments
 */
export const createTaskAttachment = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { taskId, s3Key, fileName, mimeType, fileSizeBytes } = req.body;

  if (!taskId || !s3Key || !fileName || !mimeType) {
    throw new ApiError(400, 'Task ID, S3 key, file name, and MIME type are required.');
  }

  // Validate task membership / custom role access
  await assertTaskAccess(taskId, companyId, req.user);

  const attachment = await TaskAttachment.create({
    companyId,
    taskId,
    s3Key,
    fileName,
    mimeType,
    fileType: resolveFileType(mimeType),
    fileSizeBytes: fileSizeBytes || 0,
    uploadedBy: req.user._id,
  });

  const populated = await TaskAttachment.findById(attachment._id).populate(
    'uploadedBy',
    'name email role'
  );

  return res.status(201).json(
    new ApiResponse(201, populated, 'Task attachment record saved successfully.')
  );
});

/**
 * 3. List Attachments with Preview/Stream URLs
 * GET /api/v1/task-attachments/task/:taskId
 */
export const getTaskAttachments = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { taskId } = req.params;

  // Validate task membership / custom role access
  await assertTaskAccess(taskId, companyId, req.user);

  const attachments = await TaskAttachment.find({ companyId, taskId })
    .populate('uploadedBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  const enrichedAttachments = await Promise.all(
    attachments.map(async (att) => {
      let viewUrl = null;
      try {
        viewUrl = await generatePresignedDownloadUrl(att.s3Key, 3600);
      } catch (err) {
        viewUrl = null;
      }
      return {
        ...att,
        viewUrl,
      };
    })
  );

  return res.status(200).json(
    new ApiResponse(200, enrichedAttachments, 'Task attachments retrieved successfully.')
  );
});

/**
 * 4. Get Pre-signed Download URL for Single Attachment
 * GET /api/v1/task-attachments/:id/download
 */
export const getAttachmentDownloadUrl = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;

  const attachment = await TaskAttachment.findOne({ _id: id, companyId });
  if (!attachment) {
    throw new ApiError(404, 'Task attachment not found.');
  }

  // Validate task membership / custom role access using attachment's taskId
  await assertTaskAccess(attachment.taskId, companyId, req.user);

  const downloadUrl = await generatePresignedDownloadUrl(
    attachment.s3Key,
    900,
    attachment.fileName
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { downloadUrl, fileName: attachment.fileName, mimeType: attachment.mimeType },
      'Pre-signed download URL generated.'
    )
  );
});

/**
 * 5. Delete Attachment
 * DELETE /api/v1/task-attachments/:id
 */
export const deleteTaskAttachment = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;

  const attachment = await TaskAttachment.findOne({ _id: id, companyId });
  if (!attachment) {
    throw new ApiError(404, 'Task attachment not found.');
  }

  // Validate task access first
  await assertTaskAccess(attachment.taskId, companyId, req.user);

  const isUploader = attachment.uploadedBy?.toString() === req.user._id.toString();
  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR'].includes(req.user.role);

  if (!isUploader && !isAdmin) {
    throw new ApiError(403, 'You do not have permission to delete this attachment.');
  }

  try {
    await deleteS3Object(attachment.s3Key);
  } catch (err) {
    console.warn('[S3 Warning] S3 deletion error:', err.message);
  }

  await TaskAttachment.findByIdAndDelete(id);

  return res.status(200).json(
    new ApiResponse(200, null, 'Task attachment deleted successfully.')
  );
});