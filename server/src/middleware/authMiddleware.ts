import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { User, Company } from '../models';
import Brand from '../models/brand';
import BrandUser from '../models/brandUser';

interface AuthRequest extends Request {
  user?: any;
  brandAccess?: {
    role: string;
    permissions: any;
  };
}

// Middleware to authenticate JWT token
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access: invalid or expired token'
      });
    }

    req.user = user;
    return next();
  })(req, res, next);
};

// Optional JWT authentication - doesn't error if no token
export const optionalAuthJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) {
      req.user = user;
    }
    return next();
  })(req, res, next);
};

// Check if user has admin privileges
export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: admin privileges required'
    });
    return;
  }

  next();
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
    console.error('Brand access check error:', error);
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
  authenticateJWT,
  optionalAuthJWT,
  isAdmin,
  isCompanyMember,
  hasBrandAccess,
  hasBrandRole
} as {
  [key: string]: any;
};