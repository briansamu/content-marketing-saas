import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

const TrendingTopic = sequelize.define('TrendingTopic', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT
  },
  source: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100)
  },
  relevance_score: {
    type: DataTypes.FLOAT
  },
  published_at: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default TrendingTopic;