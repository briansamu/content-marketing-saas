import express from 'express';
import authController from '../controllers/authController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = express.Router();

// Create typed handlers with double assertion
const login = authController.login as unknown as express.RequestHandler;
const register = authController.register as unknown as express.RequestHandler;
const verifyEmail = authController.verifyEmail as unknown as express.RequestHandler;
const requestPasswordReset = authController.requestPasswordReset as unknown as express.RequestHandler;
const resetPassword = authController.resetPassword as unknown as express.RequestHandler;
const getCurrentUser = authController.getCurrentUser as unknown as express.RequestHandler;

// Public auth routes
router.post('/login', login);
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Protected auth routes
router.get('/me', authenticateJWT, getCurrentUser);

export default router;