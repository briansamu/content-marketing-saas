import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { User, Company } from '../models';
import Brand from '../models/brand';
import BrandUser from '../models/brandUser';
import logger from '../utils/logger';

// Define user type for consistent type assertions
export interface AppUser {
  id: number;
  company_id: number;
  role: string;
  [key: string]: any;
}

// Extend Express Request to include user property
export interface AuthRequest extends Request {
  user?: AppUser;
  brandAccess?: {
    role: string;
    permissions: any;
  };
}

// Middleware to check if user is authenticated using session
export const isAuthenticated = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized access: please login'
  });
};

// Check if user has admin role in their company
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access: please login'
    });
  }

  const user = req.user;
  if (user && user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden: admin access required'
  });
};

// Middleware to check if user has access to requested company data
export const hasCompanyAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access: please login'
    });
  }

  const user = req.user;
  const companyId = parseInt(req.params.company_id);

  if (user && user.company_id === companyId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden: you do not have access to this company'
  });
};

// Check if user belongs to specific company
export const isCompanyMember = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: authentication required'
    });
  }

  const companyId = parseInt(req.params.companyId || req.body.companyId);

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: 'Bad request: company ID is required'
    });
  }

  if (req.user.company_id !== companyId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: not authorized for this company'
    });
  }

  next();
};

// Check if user has access to a specific brand
export const hasBrandAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: authentication required'
    });
  }

  const brandId = parseInt(req.params.brandId || req.body.brandId);

  if (!brandId) {
    return res.status(400).json({
      success: false,
      message: 'Bad request: brand ID is required'
    });
  }

  try {
    // Check if user is company admin (has access to all brands)
    if (req.user.role === 'admin') {
      // Get the brand to check if it belongs to the user's company
      const brand = await Brand.findOne({
        where: {
          id: brandId,
          company_id: req.user.company_id
        }
      });

      if (!brand) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: not authorized for this brand'
        });
      }

      return next();
    }

    // Check if the user has explicit access to this brand
    const brandUser = await BrandUser.findOne({
      where: {
        user_id: req.user.id,
        brand_id: brandId
      }
    });

    if (!brandUser) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not authorized for this brand'
      });
    }

    // Add brand access details to request
    req.brandAccess = {
      role: brandUser.role,
      permissions: brandUser.permissions
    };

    next();
  } catch (error) {
    logger.error('Brand access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while checking brand access',
      error: error.message
    });
  }
};

// Check for specific brand role
export const hasBrandRole = (requiredRole: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.brandAccess) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: brand access check required first'
      });
    }

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    if (!roles.includes(req.brandAccess.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: ${roles.join(' or ')} role required`
      });
    }

    next();
  };
};

export default {
  isAuthenticated,
  isAdmin,
  hasCompanyAccess,
  isCompanyMember,
  hasBrandAccess,
  hasBrandRole
} as {
  [key: string]: any;
};