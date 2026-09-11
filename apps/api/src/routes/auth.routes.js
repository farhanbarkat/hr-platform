import { Router } from 'express';
import {
  login,
  refreshToken,
  logout,
  setup2FA,
  confirm2FASetup,
  verify2FALogin,
  registerDeviceToken,
  getCurrentUser, 
} from '../controllers/auth.controller.js';
import { verify2FAChallenge, verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// ============================================================================
// Active Session Hydration (Resolves Frontend 404)
// ============================================================================
router.get('/me', verifyJWT, getCurrentUser); // <-- FIX 2: /me route added

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login & challenge token issuance
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh expired access token
 */
router.post('/refresh', refreshToken);

/**
 * @openapi
 * /auth/2fa/setup:
 *   post:
 *     tags:
 *       - Authentication (2FA)
 */
router.post('/2fa/setup', verify2FAChallenge, setup2FA);

/**
 * @openapi
 * /auth/2fa/confirm:
 *   post:
 *     tags:
 *       - Authentication (2FA)
 */
router.post('/2fa/confirm', verify2FAChallenge, confirm2FASetup);

/**
 * @openapi
 * /auth/2fa/verify-login:
 *   post:
 *     tags:
 *       - Authentication (2FA)
 */
router.post('/2fa/verify-login', verify2FAChallenge, verify2FALogin);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 */
router.post('/logout', verifyJWT, logout);

/**
 * @openapi
 * /auth/device-token:
 *   post:
 *     tags:
 *       - Authentication
 */
router.post('/device-token', verifyJWT, registerDeviceToken);

export default router;