import { Request, Response } from 'express';
import { User } from '../models';

// Define user type for type assertions
type AppUser = {
  id: number;
  company_id: number;
  role: string;
  [key: string]: any;
};

// Get all users in the company
export const getUsers = async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated and has company access
    const company_id = (req.user as AppUser)?.company_id;

    const users = await User.findAll({
      where: { company_id },
      attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'verification_token'] }
    });

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get a single user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const company_id = (req.user as AppUser)?.company_id;

    const user = await User.findOne({
      where: {
        id,
        company_id
      },
      attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'verification_token'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Create a new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    const company_id = (req.user as AppUser)?.company_id;

    // Validate required fields
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password, // Will be hashed in the hook
      first_name,
      last_name,
      role: role || 'user',
      company_id,
      status: 'pending',
      verification_token: Math.random().toString(36).substring(2, 15)
    } as any); // Type assertion to bypass strict type checking

    // Should send invitation email here
    // ...

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Update an existing user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, role } = req.body;
    const company_id = (req.user as AppUser)?.company_id;

    // Find the user
    const user = await User.findOne({
      where: {
        id,
        company_id
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user fields
    const updatedUser = await user.update({
      first_name: first_name !== undefined ? first_name : user.first_name,
      last_name: last_name !== undefined ? last_name : user.last_name,
      role: role !== undefined ? role : user.role
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete a user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const company_id = (req.user as AppUser)?.company_id;
    const currentUserId = (req.user as AppUser)?.id;

    // Prevent self-deletion
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Find the user
    const user = await User.findOne({
      where: {
        id,
        company_id
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user
    await user.destroy();

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Export controller methods
export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} as Record<string, (req: Request, res: Response) => Promise<any>>;