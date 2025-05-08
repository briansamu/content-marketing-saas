import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Interface for BrandUser attributes
interface BrandUserAttributes {
  id: number;
  user_id: number;
  brand_id: number;
  role: string;
  permissions: object;
  created_at: Date;
  updated_at: Date;
}

// Interface for BrandUser creation attributes
interface BrandUserCreationAttributes extends Optional<BrandUserAttributes, 'id' | 'created_at' | 'updated_at' | 'permissions'> { }

// BrandUser model for managing user access to brands
class BrandUser extends Model<BrandUserAttributes, BrandUserCreationAttributes> implements BrandUserAttributes {
  public id!: number;
  public user_id!: number;
  public brand_id!: number;
  public role!: string;
  public permissions!: object;
  public created_at!: Date;
  public updated_at!: Date;
}

BrandUser.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'viewer',
    validate: {
      isIn: [['admin', 'editor', 'viewer']]
    }
  },
  permissions: {
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
  modelName: 'BrandUser',
  tableName: 'brand_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'brand_id']
    }
  ]
});

export default BrandUser;