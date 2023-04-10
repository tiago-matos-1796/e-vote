"use strict";
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class eVoteElection extends Model{
        static associate(models) {
            eVoteElection.belongsToMany(models.eVoteUser, {
                through: "eVoteCandidateElections",
                as: 'Candidates',
                foreignKey: 'candidateId',
            });
        }
    }
    eVoteElection.init({
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV1,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        key: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'eVoteElection',
        timestamps: false
    });
    return eVoteElection;
}