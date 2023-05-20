const {sequelize} = require('../models/index');
const {QueryTypes} = require("sequelize");
const kms = require('../utils/kms.utils');
const encryption = require('../services/encryption.service');
const {client}  = require('../configs/cassandra');
const jwt = require("jsonwebtoken");
const uuid = require('uuid');
async function vote(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const userId =  jwt.decode(token).id;
    try {
        //const signaturePublicKey = await kms.getSignaturePublicKey(userId);
        const query = 'INSERT INTO votes (id, election_id, vote) VALUES (:id, :election_id, :vote)';
        const params = {id: uuid.v1(), election_id: id, vote: body.vote};
        await client.execute(query, params, {prepare: true});
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
        const countBy = (arr, prop) => arr.reduce((prev, curr) => (prev[curr[prop]] = ++prev[curr[prop]] || 1, prev), {});
        const voteCount = countBy(votes.rows, 'vote');
        return res.status(200).json(voteCount);
    } catch (err) {
        throw err;
    }
}

module.exports = {vote, showResults}