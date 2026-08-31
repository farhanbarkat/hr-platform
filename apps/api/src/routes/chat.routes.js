import { Router } from 'express';
import {
  sendMessage,
  getConversationHistory,
  markMessagesAsRead,
  getActiveConversations,
} from '../controllers/chat.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Protect all chat endpoints with JWT tenant authentication
router.use(verifyJWT);

router.route('/conversations').get(getActiveConversations);
router.route('/messages').post(sendMessage);
router.route('/:userId/messages').get(getConversationHistory);
router.route('/:userId/read').patch(markMessagesAsRead);

export default router;