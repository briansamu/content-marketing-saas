import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

const User = sequelize.define('User', {
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
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default User;