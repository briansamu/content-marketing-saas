import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Interface for Brand attributes
interface BrandAttributes {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  industry: string | null;
  logo_url: string | null;
  website_url: string | null;
  social_profiles: object;
  created_at: Date;
  updated_at: Date;
}

// Interface for Brand creation attributes
interface BrandCreationAttributes extends Optional<BrandAttributes, 'id' | 'created_at' | 'updated_at' | 'description' | 'industry' | 'logo_url' | 'website_url' | 'social_profiles'> { }

// Brand model
class Brand extends Model<BrandAttributes, BrandCreationAttributes> implements BrandAttributes {
  public id!: number;
  public company_id!: number;
  public name!: string;
  public description!: string | null;
  public industry!: string | null;
  public logo_url!: string | null;
  public website_url!: string | null;
  public social_profiles!: object;
  public created_at!: Date;
  public updated_at!: Date;
}

Brand.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  industry: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  logo_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  website_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  social_profiles: {
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
  modelName: 'Brand',
  tableName: 'brands',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Brand;