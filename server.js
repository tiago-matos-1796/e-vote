const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const models = require('./models');

const app = express();

var corsOptions = {
    origin: "http://localhost:8081"
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

models.eVoteUser.belongsToMany(models.eVoteElection, {through: 'eVoteCandidates', as: 'candidateElections', timestamps: false});
models.eVoteElection.belongsToMany(models.eVoteUser, {through: 'eVoteCandidates', as: 'candidates', timestamps: false});
models.eVoteUser.belongsToMany(models.eVoteElection, {through: 'eVoteManagers', as: 'managerElections', timestamps: false});
models.eVoteElection.belongsToMany(models.eVoteUser, {through: 'eVoteManagers', as: 'managers', timestamps: false});
models.eVoteUser.belongsToMany(models.eVoteElection, {through: models.eVoteElector, as: 'electorElections', timestamps: false});
models.eVoteElection.belongsToMany(models.eVoteUser, {through: models.eVoteElector, as: 'electors', timestamps: false});
models.eVoteElection.hasMany(models.eVoteVote, {as: 'votes', timestamps: false});
models.eVoteVote.belongsTo(models.eVoteElection, {as: 'election', timestamps: false});
models.eVoteElection.hasMany(models.eVoteLog, {as: 'logs', timestamps: false});
models.eVoteLog.belongsTo(models.eVoteElection, {as: 'electionLog', timestamps: false});

const db = require('./models');
db.sequelize.sync({force: true}).then(() => {
    console.log("Synced");
}).catch((err) => {
    console.log(`Failed to sync db: ${err.message}`);
});

// simple route
app.get("/", (req, res) => {
    res.json({ message: "Hello World!" });
});

// set port, listen for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});