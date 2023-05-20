const db = require('../models');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');
const config = process.env;
const uuid = require('uuid');
const {sequelize} = require('../models/index');
const encryption = require('../services/encryption.service');
const kms = require('../utils/kms.utils');
const {QueryTypes} = require("sequelize");
const uuidValidator = require('uuid-validate');

async function listByVoter(req, res, next) {
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const userId =  jwt.decode(token).id;
    try {
        const elections = await sequelize.query('select eve.id, eve.title, eve.start_date, eve.end_date, eve.created_at, eve.active, evv.voted from e_vote_election eve inner join e_vote_voter evv on eve.id = evv.election_id where evv.user_id = :id', {
            type: QueryTypes.SELECT,
            replacements: {id: userId}
        });
        return res.status(200).json(elections);
    } catch (err) {
        throw err;
    }
}

async function listByManager(req, res, next) {
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const userId =  jwt.decode(token).id;
    try {
        const elections = await sequelize.query('select eve.id, eve.title, eve.start_date, eve.end_date, eve.created_at, eve.active from e_vote_election eve inner join e_vote_manager evm on eve.id = evm.election_id where evm.user_id = :id;', {
            type: QueryTypes.SELECT,
            replacements: {id: userId}
        });
        return res.status(200).json(elections);
    } catch (err) {
        throw err;
    }
}

async function showBallot(req, res, next) {
    const id = req.params.id;
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const userId =  jwt.decode(token).id;
    if(!uuidValidator(id, 1)) {
        return next(createError(400, `id ${id} cannot be validated`));
    }
    try {
        const election = await sequelize.query('select * from e_vote_election eve join e_vote_candidate evc on eve.id = evc.election_id where eve.id = :id;', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        const electionPublicKey = await kms.getElectionPublicKey(id);
        const signaturePrivateKey = await kms.getSignaturePrivateKey(userId);
        const candidates = election.map(function (item) {return {id: item.id, name: item.name}});
        const electionObj = {
            id: election[0].election_id,
            title: election[0].title,
            start_date: election[0].start_date,
            end_date: election[0].end_date,
            created_at: election[0].created_at,
            active: election[0].active,
            election_key: electionPublicKey.data.key,
            signature_key: signaturePrivateKey.data.key,
            signature_iv: signaturePrivateKey.data.iv,
            candidates: candidates
        };
        return res.status(200).json(electionObj);
    } catch (err) {
        throw err;
    }
}

async function managerShow(req, res, next) {
    const id = req.params.id;
    if(!uuidValidator(id, 1)) {
        return next(createError(400, `id ${id} cannot be validated`));
    }
    try {
        const electionCandidates = await sequelize.query('select * from e_vote_election eve join e_vote_candidate evc on eve.id = evc.election_id where eve.id = :id;', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        const electionVoters = await sequelize.query('select evu.id, evu.username, evu.email, evu.display_name, evu.image from e_vote_election eve join e_vote_voter evv on eve.id = evv.election_id inner join e_vote_user evu on evu.id = evv.user_id where eve.id = :id;', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        const electionManagers = await sequelize.query('select evu.id, evu.username, evu.email, evu.display_name, evu.image from e_vote_election eve join e_vote_manager evm on eve.id = evm.election_id inner join e_vote_user evu on evu.id = evm.user_id where eve.id = :id;', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        const candidates = electionCandidates.map(function (item) {return {id: item.id, name: item.name}});
        const electionObj = {
            id: electionCandidates[0].election_id,
            title: electionCandidates[0].title,
            start_date: electionCandidates[0].start_date,
            end_date: electionCandidates[0].end_date,
            created_at: electionCandidates[0].created_at,
            active: electionCandidates[0].active,
            candidates: candidates,
            voters: electionVoters,
            managers: electionManagers
        };
        return res.status(200).json(electionObj);
    } catch (err) {
        throw err;
    }
}
async function create(req, res, next) {
    const body = req.body;
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const userId =  jwt.decode(token).id;
    if(body.candidates.length === 0) {
        return next(createError(400, `Election must have at least 1 candidate`));
    }
    const transaction = await sequelize.transaction();
    try {
        const keyPair = encryption.generateKeys(body.key);
        const electionId = uuid.v1();
        await sequelize.query('CALL insert_election (:id, :title, :start_date, :end_date);', {
            replacements: {id: electionId, title: body.title, start_date: body.start_date, end_date: body.end_date},
            transaction
        });
        await kms.insertElectionKeys(electionId, keyPair.publicKey, keyPair.publicKey, keyPair.iv);
        await sequelize.query('CALL insert_manager (:user_id, :election_id);', {
            replacements: {user_id: userId, election_id: electionId},
            transaction
        });
        for(const candidate of body.candidates) {
            await sequelize.query('CALL insert_candidate (:id, :name, :election_id);', {
                replacements: {id: uuid.v1(), name: candidate.name, election_id: electionId},
                transaction
            });
        }
        for(const voter of body.voters) {
            await sequelize.query('CALL insert_voter (:user_id, :election_id);', {
                replacements: {user_id: voter, election_id: electionId},
                transaction
            });
        }
        await transaction.commit();
        return res.status(200).json(body);
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

async function update(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    if(!uuidValidator(id, 1)) {
        return next(createError(400, `id ${id} cannot be validated`));
    }
    if(body.candidates.length === 0) {
        return next(createError(400, `Election must have at least 1 candidate`));
    }
    if(body.managers.length === 0) {
        return next(createError(400, `Election must have at least 1 manager`));
    }
    const transaction = await sequelize.transaction();
    try {
        await sequelize.query('CALL update_election (:id, :title, :startDate, :endDate, :active);', {
            replacements: {id: id, title: body.title, startDate: body.start_date, endDate: body.end_date, active: body.active},
            transaction
        });
        await sequelize.query('CALL delete_election_candidates (:id);', {
            replacements: {id: id},
            transaction
        });
        for(const candidate of body.candidates) {
            await sequelize.query('CALL insert_candidate (:id, :name, :election_id);', {
                replacements: {id: uuid.v1(), name: candidate.name, election_id: id},
                transaction
            });
        }
        await sequelize.query('CALL delete_election_managers (:id);', {
            replacements: {id: id},
            transaction
        });
        for(const manager of body.managers) {
            await sequelize.query('CALL insert_manager (:user_id, :election_id);', {
                replacements: {user_id: manager, election_id: id},
                transaction
            });
        }
        await sequelize.query('CALL delete_election_voters (:id);', {
            replacements: {id: id},
            transaction
        });
        for(const voter of body.voters) {
            await sequelize.query('CALL insert_voter (:user_id, :election_id);', {
                replacements: {user_id: voter, election_id: id},
                transaction
            });
        }
        await transaction.commit();
        return res.status(200).json(body);
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

async function remove(req, res, next) {
    const id = req.params.id;
    if(!uuidValidator(id, 1)) {
        return next(createError(400, `id ${id} cannot be validated`));
    }
    try {
        await sequelize.query('CALL delete_election (:id)', {
            replacements: {id: id}
        });
        await kms.deleteElectionKeys(id);
        return res.status(200).json(1);
    } catch (err) {
        throw err;
    }
}

async function regenerateKeys(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    try {
        const keyPair = encryption.generateKeys(body.key);
        await kms.updateElectionKeys(id, keyPair.publicKey, keyPair.privateKey, keyPair.iv);
        return res.status(200).json(1);
    } catch (err) {
        throw err;
    }
}

module.exports = {listByVoter, listByManager, showBallot, managerShow,create, update, remove, regenerateKeys}