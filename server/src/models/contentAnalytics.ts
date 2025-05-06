import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

const ContentAnalytics = sequelize.define('ContentAnalytics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  content_id: {
    type: DataTypes.INTEGER
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  engagement_rate: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  conversion_rate: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
}, {
  timestamps: true,
  createdAt: 'tracked_at',
  updatedAt: false
});

export default ContentAnalytics;