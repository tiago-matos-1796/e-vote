"use strict";
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class eVoteElectionLog extends Model {
        static associate(models) {
        }
    }
    eVoteElectionLog.init({
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
        modelName: 'eVoteElectionLog',
        timestamps: false,
    });
    return eVoteElectionLog;
};