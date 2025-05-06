import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

const Company = sequelize.define('Company', {
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
    defaultValue: 'starter'
  },
  subscription_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'active'
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Company;