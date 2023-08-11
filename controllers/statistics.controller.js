const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const crypto = require("crypto");
const kms = require("../utils/kms.utils");
const encryption = require("../services/encryption.service");
const { client } = require("../configs/cassandra.config");
const jwt = require("jsonwebtoken");
const uuid = require("uuid");
const createError = require("http-errors");
const uuidValidator = require("uuid-validate");
const moment = require("moment");
const _ = require("lodash");
const { createReports } = require("../utils/svm.utils");
const logger = require("../utils/log.utils");

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
    console.log(body.signature);
    if (!encryption.verify(body.vote, signaturePublicKey.key, body.signature)) {
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
      "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      election_title: election[0].title,
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
    await logger.insertSystemLog("/vote/:id", err.message, err.stack, "POST");
    return res.status(500).send("An error has occurred");
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
    await logger.insertSystemLog(
      "/vote/status/:id",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function countVotes(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.cookies.token;
  const username = jwt.decode(token).username;
  try {
    const election = await sequelize.query(
      "SELECT * from e_vote_election WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const candidates = await sequelize.query(
      "SELECT * from e_vote_candidate WHERE election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const voters = await sequelize.query(
      "SELECT * from e_vote_voter WHERE election_id = :id AND voted IS NOT NULL",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const query =
      "SELECT vote FROM votes WHERE election_id = :id ALLOW FILTERING";
    const params = { id: id };
    const votes = await client.execute(query, params, { prepare: true });
    if (votes.rows.length !== voters.length) {
      const log =
        "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
      const logParams = {
        id: uuid.v1(),
        log_creation: moment().format("DD-MM-YYYY HH:mm"),
        election_id: id,
        log: `Recorded votes do not match the amount of votes submitted by voters`,
        severity: "HIGH",
      };
      await client.execute(log, logParams, { prepare: true });
      return next(createError(403, `Possible fraud detected`));
    }
    const decryptionKey = await kms.getElectionPrivateKey(id);
    const decryptedVotes = [];
    for (const vote of votes.rows) {
      const decryptedVote = encryption.decrypt(
        vote.vote,
        decryptionKey.key,
        body.key,
        decryptionKey.data.iv
      );
      if (
        candidates.find((x) => x.id === decryptedVote) ||
        decryptedVote === "blank"
      ) {
        decryptedVotes.push(decryptedVote);
      } else {
        const log =
          "INSERT INTO election_log (id, log_creation, election_id, log, severity) VALUES (:id, :log_creation, :election_id, :log, :severity)";
        const logParams = {
          id: uuid.v1(),
          log_creation: moment().format("DD-MM-YYYY HH:mm"),
          election_id: id,
          log: `Vote no matching any candidate has been found`,
          severity: "MEDIUM",
        };
        await client.execute(log, logParams, { prepare: true });
      }
    }
    let voteCount = {};
    if (decryptedVotes.length === 0) {
      for (const c of candidates) {
        voteCount[c.id] = 0;
      }
    } else {
      voteCount = _.countBy(decryptedVotes);
    }
    const results = encryption.internalEncrypt(JSON.stringify(voteCount));
    const log =
      "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      election_title: election[0].title,
      log: `${username} ordered votes be counted`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    await sequelize.query("CALL insert_election_results(:id, :results);", {
      replacements: { id: id, results: results },
    });
    await createReports(id, voteCount);
    return res.status(200).send("Counted with success");
  } catch (err) {
    await logger.insertSystemLog(
      "/vote/count/:id",
      err.message,
      err.stack,
      "POST"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function showResults(req, res, next) {
  const id = req.params.id;
  try {
    const results = await sequelize.query(
      "SELECT results, pdf, xlsx from e_vote_election WHERE id = :id;",
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
      pdf: results[0].pdf,
      xlsx: results[0].xlsx,
    });
  } catch (err) {
    await logger.insertSystemLog(
      "/vote/results/:id",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
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
    await logger.insertSystemLog(
      "/vote/results/user/:id",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

module.exports = {
  vote,
  countVotes,
  showStatus,
  showResults,
  showResultsUser,
};
