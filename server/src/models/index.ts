import sequelize from '../config/database';
import User from './user.js';
import Company from './company.js';
import Brand from './brand.js';
import BrandUser from './brandUser.js';
import TrendingTopic from './trendingTopic.js';
import Content from './content.js';
import ContentAnalytics from './contentAnalytics.js';
import logger from '../utils/logger';

// User-Company relationship
User.belongsTo(Company, { foreignKey: 'company_id' });
Company.hasMany(User, { foreignKey: 'company_id' });

// Brand-Company relationship
Brand.belongsTo(Company, { foreignKey: 'company_id' });
Company.hasMany(Brand, { foreignKey: 'company_id' });

// User-Brand many-to-many relationship
User.belongsToMany(Brand, { through: BrandUser, foreignKey: 'user_id' });
Brand.belongsToMany(User, { through: BrandUser, foreignKey: 'brand_id' });

// Content-User relationship
Content.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Content, { foreignKey: 'user_id' });

// Content-Brand relationship
Content.belongsTo(Brand, { foreignKey: 'brand_id' });
Brand.hasMany(Content, { foreignKey: 'brand_id' });

// ContentAnalytics-Content relationship
ContentAnalytics.belongsTo(Content, { foreignKey: 'content_id' });
Content.hasMany(ContentAnalytics, { foreignKey: 'content_id' });

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized successfully');
  } catch (error) {
    logger.error('Error synchronizing database:', error);
  }
};

export {
  sequelize,
  User,
  Company,
  Brand,
  BrandUser,
  TrendingTopic,
  Content,
  ContentAnalytics,
  syncDatabase
};