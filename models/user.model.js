"use strict";
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class eVoteUser extends Model {
        static associate(models) {
            eVoteUser.belongsToMany(models.eVoteElection, {
                through: "eVoteCandidateElections",
                as: 'elections',
                foreignKey: "userId",
            });
        }
    }
    eVoteUser.init({
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV1,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        displayName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        auditor: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },{
        sequelize,
        modelName: 'eVoteUser',
        timestamps: false,
    });
    return eVoteUser;
};