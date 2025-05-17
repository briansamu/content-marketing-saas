import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Company } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import logger from './logger';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis';

// Define subscription tiers and their rate limits
const RATE_LIMITS = {
  // Default limits for public endpoints (unauthenticated users)
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60 // 60 requests per 15 minutes
  },

  // Subscription tier limits
  starter: {
    standard: 100,   // 100 requests per 15 minutes
    content: 50,     // 50 content generation requests per 15 minutes
    analytics: 50    // 50 analytics requests per hour (defined per endpoint)
  },

  professional: {
    standard: 500,
    content: 200,
    analytics: 200
  },

  business: {
    standard: 1000,
    content: 500,
    analytics: 500
  },

  enterprise: {
    standard: 5000,
    content: 2000,
    analytics: 2000
  }
};

// Helper function to generate a unique key for rate limiting
const generateKey = (req: Request): string => {
  const user = (req as AuthRequest).user;
  return user?.id ? `${req.ip}-user-${user.id}` : `${req.ip}`;
};

// Create a Redis store for rate limiting
const redisStore = new RedisStore({
  sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  prefix: 'rl:'
});

// Create dynamic rate limiter middleware by endpoint type
export const createRateLimiter = (endpointType: 'standard' | 'content' | 'analytics' = 'standard') => {
  // Define the time window based on endpoint type
  const windowMs = endpointType === 'analytics'
    ? 60 * 60 * 1000  // 1 hour for analytics
    : 15 * 60 * 1000; // 15 minutes for others

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Default to public limits
      let maxRequests = RATE_LIMITS.public.max;
      let userSubscription = 'public';

      // If authenticated, get the subscription tier limits
      const user = (req as AuthRequest).user;
      if (user && user.company_id) {
        // Retrieve company subscription tier
        const company = await Company.findByPk(user.company_id);

        if (company) {
          const tier = company.subscription_tier as keyof typeof RATE_LIMITS;

          if (RATE_LIMITS[tier] && RATE_LIMITS[tier][endpointType]) {
            userSubscription = tier;
            maxRequests = RATE_LIMITS[tier][endpointType];
            logger.debug(`Using '${tier}' tier rate limit for endpoint type '${endpointType}'`);
          }
        }
      }

      // Skip rate limiting for admins
      if (user && user.role === 'admin') {
        return next();
      }

      // Apply the rate limit
      const limiter = rateLimit({
        windowMs,
        max: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: generateKey,
        store: redisStore,
        message: `Rate limit exceeded. Your ${userSubscription} subscription allows ${maxRequests} requests per ${windowMs / (60 * 1000)} minutes for this endpoint.`
      });

      return limiter(req, res, next);
    } catch (error) {
      logger.error('Error in rate limiter:', error);
      // Fallback to a conservative rate limit if there's an error
      const defaultLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50,
        store: redisStore,
        message: 'Too many requests, please try again later.'
      });

      return defaultLimiter(req, res, next);
    }
  };
};

// Legacy rate limit middleware for backward compatibility
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  store: redisStore,
  message: 'Too many requests, please try again later.'
});