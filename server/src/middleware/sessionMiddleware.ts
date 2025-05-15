import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import redisClient from '../config/redis';

dotenv.config();

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '86400000'); // Default: 24 hours

// Create Redis store
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'sess:'
});

// Configure session middleware
const sessionMiddleware = session({
  store: redisStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sid', // Session cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevents client-side JS from reading the cookie
    maxAge: SESSION_MAX_AGE, // Session expiration time
    sameSite: 'lax' // Protection against CSRF
  }
});

export default sessionMiddleware; 