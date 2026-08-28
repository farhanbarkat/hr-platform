import mongoose from 'mongoose';
import { Announcement } from '../models/announcement.model.js';
import { Employee } from '../models/employee.model.js';
import { NotificationService } from '../services/notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// 1. Post Announcement (HR / Admin only)
export const createAnnouncement = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { title, body, targetAudience, targetDepartmentId, targetTeamId, priority } = req.body;

  if (!title || !body) {
    throw new ApiError(400, 'Title and Body are required.');
  }

  if (targetAudience === 'department' && !targetDepartmentId) {
    throw new ApiError(400, 'Target Department ID is required when audience is department.');
  }

  if (targetAudience === 'team' && !targetTeamId) {
    throw new ApiError(400, 'Target Team ID is required when audience is team.');
  }

  const announcement = await Announcement.create({
    companyId,
    title,
    body,
    publishedBy: req.user._id,
    targetAudience: targetAudience || 'all',
    targetDepartmentId: targetAudience === 'department' ? targetDepartmentId : null,
    targetTeamId: targetAudience === 'team' ? targetTeamId : null,
    priority: priority || 'normal',
  });

  // Trigger centralized NotificationService
  await NotificationService.notifyAnnouncement({
    announcement,
    companyId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, announcement, 'Announcement published successfully.'));
});

// 2. Get Employee Feed (Audience Scoped)
export const getMyAnnouncements = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;

  const isElevatedRole = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR', 'HR_MANAGER'].includes(req.user.role);

  // Helper function to safely populate models if registered
  const populateQuery = (query) => {
    let q = query.populate('publishedBy', 'email firstName lastName');
    if (mongoose.models.Department) {
      q = q.populate('targetDepartmentId', 'name');
    }
    if (mongoose.models.Team) {
      q = q.populate('targetTeamId', 'name');
    }
    return q;
  };

  if (isElevatedRole) {
    const query = Announcement.find({
      companyId,
      isActive: true,
    }).sort({ createdAt: -1 });

    const allAnnouncements = await populateQuery(query);

    return res
      .status(200)
      .json(new ApiResponse(200, allAnnouncements, 'Announcements retrieved successfully.'));
  }

  // Find calling employee's department and team affiliations
  const employee = await Employee.findOne({
    companyId,
    _id: req.user.employeeId,
  });

  const audienceFilters = [{ targetAudience: 'all' }];

  if (employee?.departmentId) {
    audienceFilters.push({
      targetAudience: 'department',
      targetDepartmentId: employee.departmentId,
    });
  }

  if (employee?.teamId) {
    audienceFilters.push({
      targetAudience: 'team',
      targetTeamId: employee.teamId,
    });
  }

  const query = Announcement.find({
    companyId,
    isActive: true,
    $or: audienceFilters,
  }).sort({ createdAt: -1 });

  const announcements = await populateQuery(query);

  return res
    .status(200)
    .json(new ApiResponse(200, announcements, 'Announcements retrieved successfully.'));
});

// 3. Deactivate / Archive Announcement (HR / Admin only)
export const deactivateAnnouncement = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;

  const announcement = await Announcement.findOneAndUpdate(
    { _id: id, companyId },
    { isActive: false },
    { new: true }
  );

  if (!announcement) {
    throw new ApiError(404, 'Announcement not found.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, announcement, 'Announcement archived successfully.'));
});