import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Interface for User attributes
interface UserAttributes {
  id: number;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  company_id: number | null;
  last_login: Date | null;
  status: string;
  reset_token: string | null;
  reset_token_expires: Date | null;
  verification_token: string | null;
  email_verified: boolean;
  avatar: string | null;
  created_at: Date;
  updated_at: Date;
}

// Interface for User creation attributes
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at' | 'last_login' | 'reset_token' | 'reset_token_expires' | 'verification_token' | 'email_verified' | 'avatar'> {
  password?: string; // Plain password for creation only
}

// User model with instance methods
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  // Sequelize will define these fields, so we only declare them for TypeScript
  declare id: number;
  declare email: string;
  declare password_hash: string;
  declare first_name: string | null;
  declare last_name: string | null;
  declare role: string;
  declare company_id: number | null;
  declare last_login: Date | null;
  declare status: string;
  declare reset_token: string | null;
  declare reset_token_expires: Date | null;
  declare verification_token: string | null;
  declare email_verified: boolean;
  declare avatar: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Add this field to correctly handle password in hooks
  declare password?: string;

  // Static method to create user with password
  static async createWithPassword(
    userData: Omit<UserCreationAttributes, 'password_hash'> & { password: string },
    transaction?: any
  ): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(userData.password, salt);

    const { password, ...otherData } = userData;

    // Ensure company_id is properly included in the creation attributes
    const createOptions = transaction ? { transaction } : {};

    // Debug logs to track the company_id
    console.log('Creating user with userData:', { ...userData, password: '[REDACTED]' });
    console.log('otherData contains company_id:', otherData.company_id);

    return User.create({
      ...otherData,
      password_hash,
      company_id: userData.company_id || null // Explicitly set company_id
    }, createOptions);
  }

  // Generate Gravatar URL for user
  static getGravatarUrl(email: string): string {
    const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
  }

  // Validate password
  async validPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  // Get full name
  get fullName(): string {
    return [this.first_name, this.last_name].filter(Boolean).join(' ');
  }

  // Remove sensitive data when converting to JSON
  toJSON(): object {
    const values: Partial<UserAttributes> = Object.assign({}, this.get());
    delete values.password_hash;
    delete values.reset_token;
    delete values.reset_token_expires;
    delete values.verification_token;
    return values;
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  first_name: {
    type: DataTypes.STRING(100)
  },
  last_name: {
    type: DataTypes.STRING(100)
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'user'
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'companies',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: [['active', 'inactive', 'pending', 'suspended']]
    }
  },
  reset_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verification_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('avatar');
      return rawValue || User.getGravatarUrl(this.email);
    }
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  hooks: {
    // Add a beforeCreate hook to ensure company_id is set
    beforeCreate: (user: any) => {
      // Debug log to see what's happening
      console.log('Creating user with company_id:', user.company_id);

      // Ensure company_id is set (additional safeguard)
      if (user.company_id === undefined || user.company_id === null) {
        console.error('Warning: company_id is not set during user creation');
      }
    }
  },
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default User;