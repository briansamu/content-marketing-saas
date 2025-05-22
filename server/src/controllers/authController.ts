import { Request, Response } from 'express';
import passport from 'passport';
import { User, Company } from '../models';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Op, QueryTypes } from 'sequelize';
import logger from '../utils/logger';
import { getGravatarUrl } from '../config/auth';

// Login a user with email and password
export const login = (req: Request, res: Response) => {
  passport.authenticate('local', (err, user, info) => {
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

    // Log the user in via session
    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({
          success: false,
          message: 'Login error',
          error: loginErr.message
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: {
          user: user.toJSON()
        }
      });
    });
  })(req, res);
};

// Logout user
export const logout = (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Logout error',
        error: err.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });
};

// Register a new user with associated company
export const register = async (req: Request, res: Response) => {
  // Begin a transaction to ensure both company and user are created successfully
  const transaction = await sequelize.transaction();

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
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate string fields have appropriate lengths
    if (
      first_name.length > 50 ||
      last_name.length > 50 ||
      company_name.length > 100 ||
      email.length > 100
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Input exceeds maximum length'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email },
      transaction
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      });
    }

    // Create company first
    const companyData = {
      name: company_name,
      company_type,
      subscription_tier: 'starter',
      subscription_status: 'trial',
      max_brands: 1,
      max_users: 2,
      has_white_label: false,
      billing_cycle: 'monthly',
      settings: {} // Ensure settings is initialized
    };

    logger.info('Creating company with data:', companyData);

    const company = await Company.create(companyData, { transaction });

    // Get the raw values to make sure ID is accessible
    const companyValues = company.get({ plain: true });
    logger.debug('Created company raw values:', companyValues);

    // Debug log to verify company creation
    logger.info('Created company with ID:', company.id);

    if (!company.id) {
      logger.error('Company ID is undefined or null!');

      // Try to retrieve the ID directly from the database using Sequelize model rather than raw SQL
      try {
        const latestCompany = await Company.findOne({
          where: { name: company_name },
          order: [['created_at', 'DESC']],
          limit: 1,
          transaction
        });

        if (latestCompany && latestCompany.id) {
          logger.info('Retrieved company ID from database:', latestCompany.id);
          companyValues.id = latestCompany.id;
        } else {
          await transaction.rollback();
          return res.status(500).json({
            success: false,
            message: 'Failed to generate company ID'
          });
        }
      } catch (err) {
        logger.error('Error retrieving company ID:', err);
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: 'Failed to generate company ID'
        });
      }
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Get the company ID to use (either from the model or our direct query)
    const companyId = company.id || companyValues.id;
    logger.info('Using company ID for user creation:', companyId);

    // Create user with company association - using direct assignment for clarity
    const userData = {
      email,
      password,
      first_name,
      last_name,
      company_id: companyId, // Use the company ID we found
      role: 'admin',
      status: 'pending',
      verification_token: verificationToken
    };

    logger.info('Creating user with company_id:', userData.company_id);

    const user = await User.createWithPassword(userData, transaction);

    // Verify the user has the company_id set
    logger.debug('Created user:', {
      id: user.id,
      email: user.email,
      company_id: user.company_id
    });

    // If company_id is still not set, manually update it using Sequelize model update
    if (!user.company_id) {
      logger.warn('User created without company_id, manually updating...');

      await user.update({ company_id: companyId }, { transaction });
    }

    // Commit the transaction
    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          ...user.toJSON(),
          company_id: companyId // Ensure company_id is returned in the response
        },
        company: companyValues // Return the raw company values to ensure ID is included
      }
    });

  } catch (error) {
    // Rollback transaction if any error occurs
    await transaction.rollback();
    logger.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Verify email with token
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Validate token format
    if (typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format'
      });
    }

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
    logger.error('Email verification error:', error);
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

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
    logger.error('Password reset request error:', error);
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

    // Validate token and password
    if (typeof token !== 'string' || token.length !== 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

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
    logger.error('Password reset error:', error);
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

    // Validate user ID 
    if (!user.id || isNaN(Number(user.id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Use Sequelize model instead of raw SQL
    const userData = await User.findByPk(user.id, {
      attributes: {
        exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'verification_token']
      },
      raw: true
    });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add Gravatar if no avatar is set
    if (!userData.avatar) {
      userData.avatar = getGravatarUrl(userData.email || undefined);
    }

    // Get company data if available
    let company = null;
    if (userData.company_id) {
      // Use Sequelize model instead of raw SQL
      company = await Company.findByPk(userData.company_id, { raw: true }) as any;
    }

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      user: {
        ...userData,
        company
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
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
  getCurrentUser,
  logout
};
