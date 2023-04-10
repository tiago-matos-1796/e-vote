"use strict";
const {Model} = require('sequelize');
const models = require('../models');
module.exports = (sequelize, DataTypes) => {
    class eVoteElector extends Model{
        static associate(models) {
        }
    }
    eVoteElector.init({
        eVoteUserId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: models.eVoteUser,
                key: 'id',
            }
        },
        eVoteElectionId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: models.eVoteElection,
                key: 'id',
            }
        },
        voted: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    }, {
        sequelize,
        modelName: 'eVoteElector',
        timestamps: false
    });
    return eVoteElector;
}