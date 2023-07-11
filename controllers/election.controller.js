const db = require("../models");
const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = process.env;
const uuid = require("uuid");
const { sequelize } = require("../models/index");
const encryption = require("../services/encryption.service");
const kms = require("../utils/kms.utils");
const { QueryTypes } = require("sequelize");
const uuidValidator = require("uuid-validate");
const { client } = require("../configs/cassandra");
const moment = require("moment");
const fs = require("fs");
const sharp = require("sharp");

async function listByVoter(req, res, next) {
  const token = req.body.token || req.query.token || req.headers["x-api-key"];
  const userId = jwt.decode(token).id;
  try {
    const elections = await sequelize.query(
      "select eve.id, eve.title, eve.start_date, eve.end_date, eve.created_at, eve.active, evv.voted from e_vote_election eve inner join e_vote_voter evv on eve.id = evv.election_id where evv.user_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: userId },
      }
    );
    return res.status(200).json(elections);
  } catch (err) {
    throw err;
  }
}

async function listByManager(req, res, next) {
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  try {
    const elections = await sequelize.query(
      "select eve.id, eve.title, eve.start_date, eve.end_date, eve.created_at from e_vote_election eve inner join e_vote_manager evm on eve.id = evm.election_id where evm.user_id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: userId },
      }
    );
    for (const election of elections) {
      election["startDate"] = election["start_date"];
      delete election["start_date"];
      election["endDate"] = election["end_date"];
      delete election["end_date"];
    }
    return res.status(200).json(elections);
  } catch (err) {
    throw err;
  }
}

async function showBallot(req, res, next) {
  const id = req.params.id;
  const token = req.body.token || req.query.token || req.headers["x-api-key"];
  const userId = jwt.decode(token).id;
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  try {
    const election = await sequelize.query(
      "select * from e_vote_election eve join e_vote_candidate evc on eve.id = evc.election_id where eve.id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const electionPublicKey = await kms.getElectionPublicKey(id);
    const signaturePrivateKey = await kms.getSignaturePrivateKey(userId);
    const candidates = election.map(function (item) {
      return { id: item.id, name: item.name };
    });
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
      candidates: candidates,
    };
    return res.status(200).json(electionObj);
  } catch (err) {
    throw err;
  }
}

async function managerShow(req, res, next) {
  const id = req.params.id;
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  try {
    const electionCandidates = await sequelize.query(
      "select * from e_vote_election eve join e_vote_candidate evc on eve.id = evc.election_id where eve.id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const electionVoters = await sequelize.query(
      "select evu.id, evu.username, evu.email, evu.display_name, evu.image from e_vote_election eve join e_vote_voter evv on eve.id = evv.election_id inner join e_vote_user evu on evu.id = evv.user_id where eve.id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const electionManagers = await sequelize.query(
      "select evu.id, evu.username, evu.email, evu.display_name, evu.image from e_vote_election eve join e_vote_manager evm on eve.id = evm.election_id inner join e_vote_user evu on evu.id = evm.user_id where eve.id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const candidates = electionCandidates.map(function (item) {
      return { id: item.id, name: item.name };
    });
    const electionObj = {
      id: electionCandidates[0].election_id,
      title: electionCandidates[0].title,
      start_date: electionCandidates[0].start_date,
      end_date: electionCandidates[0].end_date,
      created_at: electionCandidates[0].created_at,
      active: electionCandidates[0].active,
      candidates: candidates,
      voters: electionVoters,
      managers: electionManagers,
    };
    return res.status(200).json(electionObj);
  } catch (err) {
    throw err;
  }
}
async function create(req, res, next) {
  const body = req.body;
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  const username = jwt.decode(token).username;
  if (body.candidates.length === 0) {
    for (const image of req.files) {
      fs.unlink(
        `files/images/candidate_images/${image.originalname}`,
        function (err) {
          if (err) {
            throw err;
          }
        }
      );
    }
    return next(createError(400, `Election must have at least 1 candidate`));
  }
  const transaction = await sequelize.transaction();
  try {
    const keyPair = encryption.generateKeys(body.key);
    const electionId = uuid.v1();
    await sequelize.query(
      "CALL insert_election (:id, :title, :start_date, :end_date, :created_at);",
      {
        replacements: {
          id: electionId,
          title: body.title,
          start_date: moment(body.start_date, "YYYY-MM-DD HH:mm").format(
            "DD-MM-YYYY HH:mm"
          ),
          end_date: moment(body.end_date, "YYYY-MM-DD HH:mm").format(
            "DD-MM-YYYY HH:mm"
          ),
          created_at: moment().format("DD-MM-YYYY HH:mm"),
        },
        transaction,
      }
    );
    await kms.insertElectionKeys(
      electionId,
      keyPair.publicKey,
      keyPair.publicKey,
      keyPair.iv
    );
    await sequelize.query("CALL insert_manager (:user_id, :election_id);", {
      replacements: { user_id: userId, election_id: electionId },
      transaction,
    });
    for (const candidate of body.candidates) {
      const c = JSON.parse(candidate);
      if (c.image) {
        try {
          const image = req.files.find((obj) => {
            return obj.originalname === c.image;
          });
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}_${
            c.image
          }`;
          await sharp(`files/images/candidate_images/${image.originalname}`)
            .resize(300, 300)
            .toFormat("jpg")
            .toFile(`files/images/candidate_images/${fileName}`);
          fs.unlink(
            `files/images/candidate_images/${image.originalname}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
          c.image = fileName;
        } catch (err) {
          await transaction.rollback();
          return next(
            createError(406, `Candidate images must have unique names`)
          );
        }
      }
      await sequelize.query(
        "CALL insert_candidate (:id, :name, :image, :election_id);",
        {
          replacements: {
            id: uuid.v1(),
            name: c.name,
            image: c.image ? c.image : null,
            election_id: electionId,
          },
          transaction,
        }
      );
    }
    for (const voter of body.voters) {
      await sequelize.query("CALL insert_voter (:user_id, :election_id);", {
        replacements: { user_id: voter, election_id: electionId },
        transaction,
      });
    }
    await transaction.commit();
    const log =
      "INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: electionId,
      log: `Election ${body.title} with ID: ${electionId} has been created by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(body);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function update(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.body.token || req.query.token || req.headers["x-api-key"];
  const username = jwt.decode(token).username;
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  if (body.candidates.length === 0) {
    return next(createError(400, `Election must have at least 1 candidate`));
  }
  if (body.managers.length === 0) {
    return next(createError(400, `Election must have at least 1 manager`));
  }
  const transaction = await sequelize.transaction();
  try {
    const election = await sequelize.query(
      "SELECT * from e_vote_election WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (
      moment().isBetween(
        moment(election[0].start_date),
        moment(election[0].end_date)
      )
    ) {
      return next(createError(400, `Ongoing election`));
    }
    if (moment().isAfter(moment(election[0].end_date))) {
      return next(createError(400, `Election has ended`));
    }
    await sequelize.query(
      "CALL update_election (:id, :title, :startDate, :endDate, :active);",
      {
        replacements: {
          id: id,
          title: body.title,
          startDate: body.start_date,
          endDate: body.end_date,
          active: body.active,
        },
        transaction,
      }
    );
    await sequelize.query("CALL delete_election_candidates (:id);", {
      replacements: { id: id },
      transaction,
    });
    for (const candidate of body.candidates) {
      await sequelize.query(
        "CALL insert_candidate (:id, :name, :election_id);",
        {
          replacements: {
            id: uuid.v1(),
            name: candidate.name,
            election_id: id,
          },
          transaction,
        }
      );
    }
    await sequelize.query("CALL delete_election_managers (:id);", {
      replacements: { id: id },
      transaction,
    });
    for (const manager of body.managers) {
      await sequelize.query("CALL insert_manager (:user_id, :election_id);", {
        replacements: { user_id: manager, election_id: id },
        transaction,
      });
    }
    await sequelize.query("CALL delete_election_voters (:id);", {
      replacements: { id: id },
      transaction,
    });
    for (const voter of body.voters) {
      await sequelize.query("CALL insert_voter (:user_id, :election_id);", {
        replacements: { user_id: voter, election_id: id },
        transaction,
      });
    }
    await transaction.commit();
    const log =
      "INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      creation: moment(),
      election_id: id,
      log: `Election ${body.title} with ID: ${id} has been updated by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(body);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function remove(req, res, next) {
  const id = req.params.id;
  const token = req.body.token || req.query.token || req.headers["x-api-key"];
  const username = jwt.decode(token).username;
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  try {
    const election = await sequelize.query(
      "SELECT * from e_vote_election WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (
      moment().isBetween(
        moment(election[0].start_date),
        moment(election[0].end_date)
      )
    ) {
      return next(createError(400, `Ongoing election`));
    }
    if (moment().isAfter(moment(election[0].end_date))) {
      return next(createError(400, `Election has ended`));
    }
    await sequelize.query("CALL delete_election (:id)", {
      replacements: { id: id },
    });
    await kms.deleteElectionKeys(id);
    const log =
      "INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      creation: moment(),
      election_id: id,
      log: `Election with ID: ${id} has been deleted by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

async function regenerateKeys(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.body.token || req.query.token || req.headers["x-api-key"];
  const username = jwt.decode(token).username;
  try {
    const election = await sequelize.query(
      "SELECT * from e_vote_election WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (
      moment().isBetween(
        moment(election[0].start_date),
        moment(election[0].end_date)
      )
    ) {
      return next(createError(400, `Ongoing election`));
    }
    if (moment().isAfter(moment(election[0].end_date))) {
      return next(createError(400, `Election has ended`));
    }
    const keyPair = encryption.generateKeys(body.key);
    await kms.updateElectionKeys(
      id,
      keyPair.publicKey,
      keyPair.privateKey,
      keyPair.iv
    );
    const log =
      "INSERT INTO election_log (id, creation, election_id, log, severity) VALUES (:id, :creation, :election_id, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      creation: moment(),
      election_id: id,
      log: ` Keys have been regenerated for election with ID: ${id} by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

module.exports = {
  listByVoter,
  listByManager,
  showBallot,
  managerShow,
  create,
  update,
  remove,
  regenerateKeys,
};
