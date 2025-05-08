import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import passport from 'passport';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import bcrypt from 'bcrypt';
import sequelize from '../config/database';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Configure local strategy for username/password authentication
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      // Get user directly from database to avoid Sequelize model issues
      const [rows]: any = await sequelize.query(
        'SELECT * FROM users WHERE email = :email LIMIT 1',
        {
          replacements: { email },
          raw: true
        }
      );

      const user = rows && rows.length > 0 ? rows[0] : null;

      if (!user) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      // Check if the user's status is active
      if (user.status !== 'active') {
        return done(null, false, { message: 'Account is not active.' });
      }

      // Validate password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      // Update last login
      await sequelize.query(
        'UPDATE users SET last_login = NOW() WHERE id = :id',
        {
          replacements: { id: user.id }
        }
      );

      // Convert raw database result to User model instance
      const userModel = User.build(user, { isNewRecord: false });
      return done(null, userModel);
    } catch (error) {
      return done(error);
    }
  }
));

// Configure JWT strategy for token authentication
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET
  },
  async (payload, done) => {
    try {
      const user = await User.findByPk(payload.id);

      if (!user) {
        return done(null, false);
      }

      if (user.status !== 'active') {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }
));

// Generate JWT token
const generateToken = (user: any): string => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    company_id: user.company_id
  };

  // @ts-ignore - Type issue with jwt.sign
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export { passport, generateToken, JWT_SECRET };