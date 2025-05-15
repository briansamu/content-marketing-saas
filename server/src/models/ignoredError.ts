import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

interface IgnoredErrorAttributes {
  id: number;
  user_id: number;
  token: string;
  type: string;
  created_at: Date;
}

class IgnoredError extends Model<IgnoredErrorAttributes> implements IgnoredErrorAttributes {
  public id!: number;
  public user_id!: number;
  public token!: string;
  public type!: string;
  public created_at!: Date;
}

IgnoredError.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ignored_error',
    tableName: 'ignored_errors',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // No need for updated_at since these records won't change
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'token', 'type'],
      },
    ],
  }
);

export default IgnoredError; 