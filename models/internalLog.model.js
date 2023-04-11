"use strict";
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class eVoteInternalLog extends Model {
        static associate(models) {
        }
    }
    eVoteInternalLog.init({
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
    },{
        sequelize,
        modelName: 'eVoteInternalLog',
        timestamps: false,
    });
    return eVoteInternalLog;
};