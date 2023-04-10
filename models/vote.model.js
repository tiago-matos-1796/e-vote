"use strict";
const {Model} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class eVoteVote extends Model {
        static associate(models) {
        }
    }
    eVoteVote.init({
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV1,
        },
        vote: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },{
        sequelize,
        modelName: 'eVoteVote',
        timestamps: false,
    });
    return eVoteVote;
};