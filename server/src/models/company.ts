import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Interface for Company attributes
interface CompanyAttributes {
  id: number;
  name: string;
  subscription_tier: string;
  subscription_status: string;
  company_type: string;
  max_brands: number;
  max_users: number;
  has_white_label: boolean;
  billing_email: string | null;
  billing_address: string | null;
  billing_cycle: string;
  billing_next_date: Date | null;
  custom_domain: string | null;
  logo_url: string | null;
  settings: object;
  created_at: Date;
  updated_at: Date;
}

// Interface for Company creation attributes
interface CompanyCreationAttributes extends Optional<CompanyAttributes, 'id' | 'created_at' | 'updated_at' | 'billing_email' | 'billing_address' | 'billing_next_date' | 'custom_domain' | 'logo_url' | 'settings'> { }

// Company model
class Company extends Model<CompanyAttributes, CompanyCreationAttributes> implements CompanyAttributes {
  declare id: number;
  declare name: string;
  declare subscription_tier: string;
  declare subscription_status: string;
  declare company_type: string;
  declare max_brands: number;
  declare max_users: number;
  declare has_white_label: boolean;
  declare billing_email: string | null;
  declare billing_address: string | null;
  declare billing_cycle: string;
  declare billing_next_date: Date | null;
  declare custom_domain: string | null;
  declare logo_url: string | null;
  declare settings: object;
  declare created_at: Date;
  declare updated_at: Date;
}

Company.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  subscription_tier: {
    type: DataTypes.STRING(50),
    defaultValue: 'starter',
    validate: {
      isIn: [['starter', 'professional', 'business', 'enterprise']]
    }
  },
  subscription_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'trial', 'past_due', 'canceled']]
    }
  },
  company_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'in_house',
    validate: {
      isIn: [['agency', 'in_house', 'creator']]
    }
  },
  max_brands: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  max_users: {
    type: DataTypes.INTEGER,
    defaultValue: 2
  },
  has_white_label: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  billing_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  billing_address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  billing_cycle: {
    type: DataTypes.STRING(20),
    defaultValue: 'monthly',
    validate: {
      isIn: [['monthly', 'annually']]
    }
  },
  billing_next_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  custom_domain: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  logo_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {}
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
  sequelize,
  modelName: 'Company',
  tableName: 'companies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Company;