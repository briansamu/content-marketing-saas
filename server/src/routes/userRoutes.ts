import express from 'express';
import userController from '../controllers/userController';
import { authenticateJWT, isAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Route handlers with type assertions
const getUsers = userController.getUsers as express.RequestHandler;
const getUserById = userController.getUserById as express.RequestHandler;
const createUser = userController.createUser as express.RequestHandler;
const updateUser = userController.updateUser as express.RequestHandler;
const deleteUser = userController.deleteUser as express.RequestHandler;

// Get all users (admin only)
router.get('/', isAdmin, getUsers);

// Get user by ID (admin or self)
router.get('/:id', getUserById);

// Create a new user (admin only)
router.post('/', isAdmin, createUser);

// Update user (admin or self)
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', isAdmin, deleteUser);

export default router;