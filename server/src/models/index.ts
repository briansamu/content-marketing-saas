import sequelize from '../config/database';
import User from './user.js';
import Company from './company.js';
import TrendingTopic from './trendingTopic.js';
import Content from './content.js';
import ContentAnalytics from './contentAnalytics.js';

User.belongsTo(Company);
Company.hasMany(User);

Content.belongsTo(User);
User.hasMany(Content);

ContentAnalytics.belongsTo(Content);
Content.hasMany(ContentAnalytics);

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database:', error);
  }
};

export {
  sequelize,
  User,
  Company,
  TrendingTopic,
  Content,
  ContentAnalytics,
  syncDatabase
};