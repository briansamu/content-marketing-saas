import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';

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
  created_at: Date;
  updated_at: Date;
}

// Interface for User creation attributes
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at' | 'last_login' | 'reset_token' | 'reset_token_expires' | 'verification_token' | 'email_verified'> {
  password: string; // Plain password for creation only
}

// User model with instance methods
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public first_name!: string | null;
  public last_name!: string | null;
  public role!: string;
  public company_id!: number | null;
  public last_login!: Date | null;
  public status!: string;
  public reset_token!: string | null;
  public reset_token_expires!: Date | null;
  public verification_token!: string | null;
  public email_verified!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Static method to create user with password
  static async createWithPassword(userData: Omit<UserCreationAttributes, 'password_hash'> & { password: string }): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(userData.password, salt);

    const { password, ...otherData } = userData;
    return User.create({ ...otherData, password_hash } as any);
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
    type: DataTypes.INTEGER
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
    beforeCreate: async (user: User & { password?: string }) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password, salt);
        // Don't delete user.password here, as it may cause issues
      } else {
        throw new Error('Password is required for user creation');
      }
    },
    beforeUpdate: async (user: User & { password?: string }) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password, salt);
        // Don't delete user.password here, as it may cause issues
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