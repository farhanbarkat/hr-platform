import { Router } from 'express';
import {
  login,
  refreshToken,
  logout,
  setup2FA,
  confirm2FASetup,
  verify2FALogin,
  registerDeviceToken,
} from '../controllers/auth.controller.js';
import { verify2FAChallenge, verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Public / Unauthenticated / Challenge Routes
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/2fa/setup', verify2FAChallenge, setup2FA);
router.post('/2fa/confirm', verify2FAChallenge, confirm2FASetup);
router.post('/2fa/verify-login', verify2FAChallenge, verify2FALogin);

// Protected Routes
router.post('/logout', verifyJWT, logout);
router.post('/device-token', verifyJWT, registerDeviceToken);

export default router;