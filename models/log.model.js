"use strict";
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class eVoteLog extends Model {
        static associate(models) {
        }
    }
    eVoteLog.init({
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV1,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        createdBy: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        severity: {
            type: DataTypes.ENUM('NONE', 'LOW', 'MEDIUM', 'HIGH'),
            allowNull: false,
        },
    },{
        sequelize,
        modelName: 'eVoteLog',
        timestamps: false,
    });
    return eVoteLog;
};