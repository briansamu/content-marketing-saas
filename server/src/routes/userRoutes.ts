import express from 'express';
import userController from '../controllers/userController';
import { authenticateJWT, isAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT as express.RequestHandler);

// Route handlers with type assertions
const getUsers = userController.getUsers as express.RequestHandler;
const getUserById = userController.getUserById as express.RequestHandler;
const createUser = userController.createUser as express.RequestHandler;
const updateUser = userController.updateUser as express.RequestHandler;
const deleteUser = userController.deleteUser as express.RequestHandler;

// Get all users (admin only)
router.get('/', isAdmin as express.RequestHandler, getUsers);

// Get user by ID (admin or self)
router.get('/:id', getUserById);

// Create a new user (admin only)
router.post('/', isAdmin as express.RequestHandler, createUser);

// Update user (admin or self)
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', isAdmin as express.RequestHandler, deleteUser);

export default router;