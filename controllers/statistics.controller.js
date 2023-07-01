const {sequelize} = require('../models/index');
const {QueryTypes} = require("sequelize");
const crypto = require('crypto');
const kms = require('../utils/kms.utils');
const encryption = require('../services/encryption.service');
const {client}  = require('../configs/cassandra');
const jwt = require("jsonwebtoken");
const uuid = require('uuid');
const createError = require('http-errors');
const uuidValidator = require('uuid-validate');
const moment = require('moment');

async function vote(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const decodedToken = jwt.decode(token);
    if(!uuidValidator(id, 1)) {
        return next(createError(400, `id ${id} cannot be validated`));
    }
    try {
        const hash = crypto.createHash('sha512');
        const election = await sequelize.query('SELECT * from e_vote_election WHERE id = :id', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        if(!moment().isBetween(moment(election[0].start_date), moment(election[0].end_date))) {
            return next(createError(400, `Election is not active`));
        }
        if(!election[0].active) {
            return next(createError(400, `Election is not active`));
        }
        const voter = await sequelize.query('SELECT * from e_vote_voter WHERE user_id = :user AND election_id = :election', {
            type: QueryTypes.SELECT,
            replacements: {user: decodedToken.id, election: id}
        });
        if(voter.length === 0) {
            const log = 'INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)';
            const logParams = {id: uuid.v1(), creation: moment(), election_id: id, log: `${decodedToken.username} is not a voter in this election`, severity: 'MEDIUM'};
            await client.execute(log, logParams, {prepare: true});
            return next(createError(403, `Not voter in this election`));
        }
        if(voter[0].voted !== null) {
            const log = 'INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)';
            const logParams = {id: uuid.v1(), creation: moment(), election_id: id, log: `${decodedToken.username} had already voted, vote discarded`, severity: 'LOW'};
            await client.execute(log, logParams, {prepare: true});
            return next(createError(400, `Already voted`));
        }
        if(body.hash !== hash.update(body.vote, 'utf8').digest('hex')) {
            const log = 'INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)';
            const logParams = {id: uuid.v1(), creation: moment(), election_id: id, log: `${decodedToken.username} submitted a tampered vote`, severity: 'HIGH'};
            await client.execute(log, logParams, {prepare: true});
            return next(createError(400, `Vote content could not be validated`));
        }
        const signaturePublicKey = await kms.getSignaturePublicKey(decodedToken.id);
        if(!encryption.verify(body.vote, signaturePublicKey.data.key, body.signature)) {
            const log = 'INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)';
            const logParams = {id: uuid.v1(), creation: moment(), election_id: id, log: `${decodedToken.username}'s signature could not be validated`, severity: 'HIGH'};
            await client.execute(log, logParams, {prepare: true});
            return next(createError(400, `Signature could not be validated`));
        }
        const query = 'INSERT INTO votes (id, election_id, vote) VALUES (:id, :election_id, :vote)';
        const params = {id: uuid.v1(), election_id: id, vote: body.vote};
        const log = 'INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)';
        const logParams = {id: uuid.v1(), creation: moment(), election_id: id, log: `${decodedToken.username} submitted vote`, severity: 'NONE'};
        await client.execute(log, logParams, {prepare: true});
        await client.execute(query, params, {prepare: true});
        await sequelize.query('CALL vote_submission (:voter, :election, :time);', {
            replacements: {voter: decodedToken.id, election: id, time: moment()}
        });
        return res.status(200).json('Vote submitted with success');
    } catch (err) {
        throw err;
    }
}

async function showResults(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const userId =  jwt.decode(token).id;
    try {
        const query = 'SELECT vote FROM votes WHERE election_id = :id ALLOW FILTERING' ;
        const params = {id: id};
        const votes = await client.execute(query, params, {prepare: true});
        const decryptionKey = await kms.getElectionPrivateKey(id);
        const decryptedVotes = [];
        for(const vote of votes.rows) {
            decryptedVotes.push(encryption.decrypt(vote, decryptionKey.data.key, decryptionKey.data.iv));
        }
        /*const voteCount = decryptedVotes.reduce(function (acc, curr) {
            return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc
        }, {});*/
        const voteCount = decryptedVotes.reduce(function (acc, curr) {
            return acc[curr] = (acc[curr] || 0) + 1;
        }, {});
        //const countBy = (arr, prop) => arr.reduce((prev, curr) => (prev[curr[prop]] = ++prev[curr[prop]] || 1, prev), {});
        //const voteCount = countBy(votes.rows, 'vote');
        return res.status(200).json(voteCount);
    } catch (err) {
        throw err;
    }
}

module.exports = {vote, showResults}