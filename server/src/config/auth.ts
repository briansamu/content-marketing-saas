import { Strategy as LocalStrategy } from 'passport-local';
import passport from 'passport';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import sequelize from '../config/database';
import crypto from 'crypto';

dotenv.config();

// Helper function to get Gravatar URL
const getGravatarUrl = (email: string): string => {
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
};

// Configure serialization for session storage
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    // Query the user directly from database
    const [rows]: any = await sequelize.query(
      'SELECT * FROM users WHERE id = :id LIMIT 1',
      {
        replacements: { id },
        raw: true
      }
    );

    const user = rows && rows.length > 0 ? rows[0] : null;

    if (!user) {
      return done(null, false);
    }

    // Add avatar URL if not present
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
});

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

      // Process user data before returning
      // Add avatar URL if not present
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