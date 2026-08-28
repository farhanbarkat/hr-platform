import { Notification } from '../models/notification.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/v1/notifications (Fetch User In-App Notifications & Unread Count)
export const getMyNotifications = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const recipientId = req.user._id;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [notifications, totalUnread, totalCount] = await Promise.all([
    Notification.find({ companyId, recipientId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ companyId, recipientId, isRead: false }),
    Notification.countDocuments({ companyId, recipientId }),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        notifications,
        totalUnread,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
        },
      },
      'Notifications retrieved successfully.'
    )
  );
});

// PATCH /api/v1/notifications/:id/read (Mark single notification as read)
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, companyId, recipientId: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, notification, 'Notification marked as read.'));
});

// PATCH /api/v1/notifications/read-all (Mark all as read)
export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const recipientId = req.user._id;

  await Notification.updateMany(
    { companyId, recipientId, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'All notifications marked as read.'));
});