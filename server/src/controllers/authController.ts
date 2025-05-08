import { Request, Response } from 'express';
import passport from 'passport';
import { User, Company } from '../models';
import { generateToken } from '../config/auth';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Op, QueryTypes } from 'sequelize';

// Login with email/password
export const login = (req: Request, res: Response) => {
  passport.authenticate('local', { session: false }, (err: Error, user: any, info: any) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: err.message
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: info.message || 'Authentication failed'
      });
    }

    // Generate token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        user: user.toJSON()
      }
    });
  })(req, res);
};

// Register a new user with associated company
export const register = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      company_name,
      company_type = 'in_house'
    } = req.body;

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !company_name) {
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

    // Create company first
    const company = await Company.create({
      name: company_name,
      company_type,
      subscription_tier: 'starter',
      subscription_status: 'trial',
      max_brands: 1,
      max_users: 2,
      has_white_label: false,
      billing_cycle: 'monthly'
    });

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user with company association using the static method
    const user = await User.createWithPassword({
      email,
      password,
      first_name,
      last_name,
      company_id: company.id,
      role: 'admin', // First user is admin of the company
      status: 'pending',
      verification_token: verificationToken
    });

    // Generate JWT token
    const token = generateToken(user);

    // Should send verification email here
    // ...

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: user.toJSON(),
        company
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Verify email with token
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: { verification_token: token }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Update user status
    await user.update({
      status: 'active',
      email_verified: true,
      verification_token: null
    });

    return res.status(200).json({
      success: true,
      message: 'Email verification successful'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: error.message
    });
  }
};

// Request password reset
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal that the user doesn't exist
      return res.status(200).json({
        success: true,
        message: 'If your email exists in our system, you will receive a password reset link'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Update user with reset token
    await user.update({
      reset_token: resetToken,
      reset_token_expires: resetTokenExpires
    });

    // Should send reset email here
    // ...

    return res.status(200).json({
      success: true,
      message: 'If your email exists in our system, you will receive a password reset link'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Password reset request failed',
      error: error.message
    });
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Hash password and update user
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await user.update({
      password_hash,
      reset_token: null,
      reset_token_expires: null
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      success: false,
      message: 'Password reset failed',
      error: error.message
    });
  }
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // User is attached by the auth middleware
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // Get user with company information
    const userWithCompany = await User.findByPk(user.id, {
      include: [{ model: Company }]
    });

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: userWithCompany
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user',
      error: error.message
    });
  }
};

export default {
  login,
  register,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  getCurrentUser
};
