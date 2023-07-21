const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const crypto = require("crypto");
const kms = require("../utils/kms.utils");
const encryption = require("../services/encryption.service");
const { client } = require("../configs/cassandra");
const jwt = require("jsonwebtoken");
const uuid = require("uuid");
const createError = require("http-errors");
const uuidValidator = require("uuid-validate");
const moment = require("moment");
const _ = require("lodash");
const net = require("net");

async function vote(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.cookies.token;
  const decodedToken = jwt.decode(token);
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  try {
    const hash = crypto.createHash("sha512");
    const election = await sequelize.query(
      "SELECT * from e_vote_election WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (
      !moment().isBetween(
        moment(election[0].start_date, "DD-MM-YYYY HH:mm"),
        moment(election[0].end_date, "DD-MM-YYYY HH:mm")
      )
    ) {
      return next(createError(400, `Election is not active`));
    }
    const voter = await sequelize.query(
      "SELECT * from e_vote_voter WHERE user_id = :user AND election_id = :election",
      {
        type: QueryTypes.SELECT,
        replacements: { user: decodedToken.id, election: id },
      }
    );
    if (voter.length === 0) {
      const log =
        "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
      const logParams = {
        id: uuid.v1(),
        log_creation: moment().format("DD-MM-YYYY HH:mm"),
        election_id: id,
        log: `${decodedToken.username} is not a voter in this election`,
        severity: "MEDIUM",
      };
      await client.execute(log, logParams, { prepare: true });
      return next(createError(403, `Not voter in this election`));
    }
    if (voter[0].voted !== null) {
      const log =
        "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
      const logParams = {
        id: uuid.v1(),
        log_creation: moment().format("DD-MM-YYYY HH:mm"),
        election_id: id,
        log: `${decodedToken.username} had already voted, vote discarded`,
        severity: "LOW",
      };
      await client.execute(log, logParams, { prepare: true });
      return next(createError(400, `Already voted`));
    }
    if (body.hash !== hash.update(body.vote, "utf8").digest("base64")) {
      const log =
        "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
      const logParams = {
        id: uuid.v1(),
        log_creation: moment().format("DD-MM-YYYY HH:mm"),
        election_id: id,
        log: `${decodedToken.username} submitted a tampered vote`,
        severity: "HIGH",
      };
      await client.execute(log, logParams, { prepare: true });
      return next(createError(400, `Vote content could not be validated`));
    }
    const signaturePublicKey = await kms.getSignaturePublicKey(decodedToken.id);
    if (
      !encryption.verify(body.vote, signaturePublicKey.data.key, body.signature)
    ) {
      const log =
        "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
      const logParams = {
        id: uuid.v1(),
        log_creation: moment().format("DD-MM-YYYY HH:mm"),
        election_id: id,
        log: `${decodedToken.username}'s signature could not be validated`,
        severity: "HIGH",
      };
      await client.execute(log, logParams, { prepare: true });
      return next(createError(400, `Signature could not be validated`));
    }
    const query =
      "INSERT INTO votes (id, election_id, vote) VALUES (:id, :election_id, :vote)";
    const params = { id: uuid.v1(), election_id: id, vote: body.vote };
    const log =
      "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      log: `${decodedToken.username} submitted vote`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    await client.execute(query, params, { prepare: true });
    await sequelize.query("CALL vote_submission (:voter, :election, :time);", {
      replacements: {
        voter: decodedToken.id,
        election: id,
        time: moment().format("DD-MM-YYYY HH:mm"),
      },
    });
    return res.status(200).json("Vote submitted with success");
  } catch (err) {
    throw err;
  }
}

async function showStatus(req, res, next) {
  const id = req.params.id;
  try {
    const voters = await sequelize.query(
      "select evu.id, evu.email, evu.display_name, evv.voted from e_vote_voter evv inner join e_vote_user evu on evu.id = evv.user_id where evv.election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const voted = voters.filter((x) => x.voted !== null).length;
    const notVoted = voters.length - voted;
    return res.status(200).json({
      data: [
        ["Voted", voted],
        ["Not Voted", notVoted],
      ],
      voters: voters,
    });
  } catch (err) {
    throw err;
  }
}

async function countVotes(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.cookies.token;
  const username = jwt.decode(token).username;
  try {
    const query =
      "SELECT vote FROM votes WHERE election_id = :id ALLOW FILTERING";
    const params = { id: id };
    const votes = await client.execute(query, params, { prepare: true });
    const decryptionKey = await kms.getElectionPrivateKey(id);
    const decryptedVotes = [];
    for (const vote of votes.rows) {
      decryptedVotes.push(
        encryption.decrypt(
          vote.vote,
          decryptionKey.data.key,
          body.key,
          decryptionKey.data.iv
        )
      );
    }
    const voteCount = _.countBy(decryptedVotes);
    const results = encryption.internalEncrypt(JSON.stringify(voteCount));
    const log =
      "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      log: `${username} ordered votes be counted`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    await sequelize.query("CALL insert_election_results(:id, :results);", {
      replacements: { id: id, results: results },
    });
    return res.status(200).send("Counted with success");
  } catch (err) {
    throw err;
  }
}

async function showResults(req, res, next) {
  const id = req.params.id;
  try {
    const results = await sequelize.query(
      "SELECT results from e_vote_election WHERE id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const candidates = await sequelize.query(
      "SELECT id, name from e_vote_candidate WHERE election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const voters = await sequelize.query(
      "select evu.id, evu.email, evu.display_name, evv.voted from e_vote_voter evv inner join e_vote_user evu on evu.id = evv.user_id where evv.election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (!results) {
      return next(createError(400, `Election ${id} has no results`));
    }
    if (!candidates) {
      return next(createError(400, `Election ${id} has no candidates`));
    }
    const decryptedResults = JSON.parse(
      encryption.internalDecrypt(Buffer.from(results[0].results, "base64"))
    );
    const candidateVotes = [];
    for (const candidate of candidates) {
      candidate["votes"] = decryptedResults[candidate.id];
      candidateVotes.push([candidate.name, decryptedResults[candidate.id]]);
    }
    const voted = voters.filter((x) => x.voted !== null).length;
    const notVoted = voters.length - voted;
    return res.status(200).json({
      candidates: candidates,
      voters: voters,
      abstention: [
        ["Voted", voted],
        ["Not Voted", notVoted],
      ],
      voteData: candidateVotes,
    });
  } catch (err) {
    throw err;
  }
}

async function showResultsUser(req, res, next) {
  const id = req.params.id;
  try {
    const results = await sequelize.query(
      "SELECT results from e_vote_election WHERE id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const candidates = await sequelize.query(
      "SELECT id, name from e_vote_candidate WHERE election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const voters = await sequelize.query(
      "select evu.id, evu.email, evu.display_name, evv.voted from e_vote_voter evv inner join e_vote_user evu on evu.id = evv.user_id where evv.election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (!results) {
      return next(createError(400, `Election ${id} has no results`));
    }
    if (!candidates) {
      return next(createError(400, `Election ${id} has no candidates`));
    }
    const decryptedResults = JSON.parse(
      encryption.internalDecrypt(Buffer.from(results[0].results, "base64"))
    );
    const candidateVotes = [];
    for (const candidate of candidates) {
      candidate["votes"] = decryptedResults[candidate.id];
      candidateVotes.push([candidate.name, decryptedResults[candidate.id]]);
    }
    const voted = voters.filter((x) => x.voted !== null).length;
    const notVoted = voters.length - voted;
    return res.status(200).json({
      candidates: candidates,
      abstention: [
        ["Voted", voted],
        ["Not Voted", notVoted],
      ],
      voteData: candidateVotes,
    });
  } catch (err) {
    throw err;
  }
}

module.exports = { vote, countVotes, showStatus, showResults, showResultsUser };
