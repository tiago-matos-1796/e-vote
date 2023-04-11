const Sequelize = require("sequelize");
const env = require('dotenv').config().parsed;
const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
    host: env.DB_HOST,
    dialect: env.DIALECT,
})

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.eVoteUser = require("./user.model")(sequelize, Sequelize);
db.eVoteElection = require("./election.model")(sequelize, Sequelize);
db.eVoteElector = require("./elector.model")(sequelize, Sequelize);
db.eVoteVote = require("./vote.model")(sequelize, Sequelize);
db.eVoteElectionLog = require("./electionLog.model")(sequelize, Sequelize);
db.eVoteInternalLog = require("./internalLog.model")(sequelize, Sequelize);

module.exports = db;