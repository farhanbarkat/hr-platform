import mongoose from 'mongoose';
import { ChatMessage } from '../models/chatMessage.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Send a direct chat message (REST fallback / standard)
 * @route   POST /api/v1/chat/messages
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { recipientId, body } = req.body;
  const senderId = req.user._id;
  const companyId = req.user.companyId;

  if (!recipientId || !body?.trim()) {
    throw new ApiError(400, 'Recipient ID and message body are required.');
  }

  if (recipientId.toString() === senderId.toString()) {
    throw new ApiError(400, 'You cannot send a direct message to yourself.');
  }

  // Tenant Boundary Check: Ensure recipient exists in the exact same company
  const recipient = await User.findOne({
    _id: recipientId,
    companyId,
  });

  if (!recipient) {
    throw new ApiError(404, 'Recipient not found within your company organization.');
  }

  const message = await ChatMessage.create({
    companyId,
    senderId,
    recipientId,
    body: body.trim(),
  });

  const populatedMessage = await ChatMessage.findById(message._id)
    .populate('senderId', 'email role')
    .populate('recipientId', 'email role');

  // Emit real-time Socket event if io is mounted on express app
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${recipientId.toString()}`).emit('chat:message_received', populatedMessage);
  }

  return res
    .status(201)
    .json(new ApiResponse(201, populatedMessage, 'Message sent successfully.'));
});

/**
 * @desc    Get conversation history between authenticated user and peer
 * @route   GET /api/v1/chat/:userId/messages
 */
export const getConversationHistory = asyncHandler(async (req, res) => {
  const { userId: peerUserId } = req.params;
  const currentUserId = req.user._id;
  const companyId = req.user.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(peerUserId)) {
    throw new ApiError(400, 'Invalid user ID.');
  }

  // Verify peer user belongs to same company
  const peerExists = await User.findOne({ _id: peerUserId, companyId });
  if (!peerExists) {
    throw new ApiError(404, 'User not found in your company.');
  }

  const filter = {
    companyId,
    $or: [
      { senderId: currentUserId, recipientId: peerUserId },
      { senderId: peerUserId, recipientId: currentUserId },
    ],
  };

  const total = await ChatMessage.countDocuments(filter);
  const messages = await ChatMessage.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('senderId', 'email role')
    .populate('recipientId', 'email role');

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        messages: messages.reverse(),
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
      'Conversation history retrieved.'
    )
  );
});

/**
 * @desc    Mark all messages from a specific sender as read
 * @route   PATCH /api/v1/chat/:userId/read
 */
export const markMessagesAsRead = asyncHandler(async (req, res) => {
  const { userId: peerUserId } = req.params;
  const currentUserId = req.user._id;
  const companyId = req.user.companyId;

  if (!mongoose.Types.ObjectId.isValid(peerUserId)) {
    throw new ApiError(400, 'Invalid user ID.');
  }

  const now = new Date();

  // Mark all unread messages sent by peer to current user as read
  const result = await ChatMessage.updateMany(
    {
      companyId,
      senderId: peerUserId,
      recipientId: currentUserId,
      readAt: null,
    },
    {
      $set: { readAt: now },
    }
  );

  // Notify sender in real time via Socket.io
  const io = req.app.get('io');
  if (io && result.modifiedCount > 0) {
    io.to(`user:${peerUserId.toString()}`).emit('chat:messages_read', {
      readBy: currentUserId,
      readAt: now,
      modifiedCount: result.modifiedCount,
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount, readAt: now },
      'Messages marked as read.'
    )
  );
});

/**
 * @desc    Get active direct conversation list with latest message and unread count
 * @route   GET /api/v1/chat/conversations
 */
export const getActiveConversations = asyncHandler(async (req, res) => {
  const currentUserId = new mongoose.Types.ObjectId(req.user._id);
  const companyId = new mongoose.Types.ObjectId(req.user.companyId);

  const conversations = await ChatMessage.aggregate([
    {
      $match: {
        companyId,
        $or: [{ senderId: currentUserId }, { recipientId: currentUserId }],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$senderId', currentUserId] },
            '$recipientId',
            '$senderId',
          ],
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$recipientId', currentUserId] },
                  { $eq: ['$readAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'peerUser',
      },
    },
    { $unwind: '$peerUser' },
    {
      $project: {
        _id: 1,
        peerUser: {
          _id: '$peerUser._id',
          email: '$peerUser.email',
          role: '$peerUser.role',
        },
        lastMessage: {
          _id: '$lastMessage._id',
          body: '$lastMessage.body',
          senderId: '$lastMessage.senderId',
          recipientId: '$lastMessage.recipientId',
          readAt: '$lastMessage.readAt',
          createdAt: '$lastMessage.createdAt',
        },
        unreadCount: 1,
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, conversations, 'Active conversations retrieved.'));
});