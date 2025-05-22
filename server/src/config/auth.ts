import { Strategy as LocalStrategy } from 'passport-local';
import passport from 'passport';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import sequelize from '../config/database';
import crypto from 'crypto';
import { User } from '../models';

dotenv.config();

// Helper function to get Gravatar URL
const getGravatarUrl = (email: string | undefined): string => {
  if (!email) {
    // Return default avatar if email is undefined
    return 'https://www.gravatar.com/avatar/default?d=mp&s=200';
  }
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
};

// Configure serialization for session storage
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    if (!id || isNaN(Number(id))) {
      return done(new Error('Invalid user ID'), false);
    }

    // Use Sequelize model instead of raw SQL
    const user = await User.findByPk(id, {
      attributes: {
        exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'verification_token']
      },
      raw: true
    });

    if (!user) {
      return done(null, false);
    }

    // Add avatar URL if not present - with safety check for email
    if (!user.avatar && user.email) {
      user.avatar = getGravatarUrl(user.email);
    } else if (!user.avatar) {
      user.avatar = getGravatarUrl(undefined);
    }

    // Create a plain object with processed data
    const processedUser = {
      ...user,
      toJSON: () => {
        return user; // Sensitive data already excluded in the query
      }
    };

    return done(null, processedUser);
  } catch (error) {
    return done(error);
  }
});

// Configure local strategy for username/password authentication
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return done(null, false, { message: 'Invalid email format.' });
      }

      // Use Sequelize model instead of raw SQL, but get all fields
      const user = await User.findOne({
        where: { email },
        raw: true
      });

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

      // Update last login using model instead of raw SQL
      await User.update(
        { last_login: new Date() },
        { where: { id: user.id } }
      );

      // Add avatar URL if not present - with safety check for email
      if (!user.avatar) {
        user.avatar = getGravatarUrl(user.email);
      }

      // Create a plain object with processed data
      const processedUser = {
        ...user,
        toJSON: () => {
          const { password_hash, reset_token, reset_token_expires, verification_token, ...userWithoutSensitiveData } = user;
          return userWithoutSensitiveData;
        }
      };

      return done(null, processedUser);
    } catch (error) {
      return done(error);
    }
  }
));

export { passport, getGravatarUrl };