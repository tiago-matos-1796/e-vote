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
const { createReports, submitVote } = require("../utils/svm.utils");
const logger = require("../utils/log.utils");
const sanitize = require("sanitize-filename");

async function vote(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.cookies.token;
  let decodedToken = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      decodedToken = decoded;
    }
  });
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  try {
    const hash = encryption.createHash(body.vote, body.key);
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
      await logger.insertElectionLog(
        id,
        election[0].title,
        `${decodedToken.username} is not a voter in this election`,
        "MEDIUM"
      );
      return next(createError(403, `Not voter in this election`));
    }
    if (voter[0].voted !== null) {
      await logger.insertElectionLog(
        id,
        election[0].title,
        `${decodedToken.username} had already voted, vote discarded`,
        "LOW"
      );
      return next(createError(400, `Already voted`));
    }
    if (body.hash !== hash) {
      await logger.insertElectionLog(
        id,
        election[0].title,
        `${decodedToken.username} submitted a tampered vote`,
        "HIGH"
      );
      return next(createError(400, `Vote content could not be validated`));
    }
    const kmsConn = await kms.kmsConnection();
    if (!kmsConn) {
      await logger.insertElectionLog(
        id,
        election[0].title,
        `${decodedToken.username} could not submit its vote, KMS is offline`,
        "HIGH"
      );
      return res.status(500).send("An error has occurred");
    }
    const signaturePublicKey = await kms.getSignaturePublicKey(decodedToken.id);
    if (!encryption.verify(body.vote, signaturePublicKey.key, body.signature)) {
      await logger.insertElectionLog(
        id,
        election[0].title,
        `${decodedToken.username}'s signature could not be validated`,
        "HIGH"
      );
      return next(createError(400, `Signature could not be validated`));
    }
    await submitVote(id, body.vote);
    await logger.insertElectionLog(
      id,
      election[0].title,
      `${decodedToken.username} submitted vote`,
      "NONE"
    );
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
  let detection = false;
  const token = req.cookies.token;
  let username = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      username = decoded.username;
    }
  });
  if (!uuidValidator(id, 1)) {
    return next(createError(401, `id ${id} cannot be validated`));
  }
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
      detection = true;
      await logger.insertElectionLog(
        id,
        election[0].title,
        `Recorded votes do not match the amount of votes submitted by voters`,
        "HIGH"
      );
    }
    const kmsConn = await kms.kmsConnection();
    if (!kmsConn) {
      await logger.insertElectionLog(
        id,
        election[0].title,
        `Could not count votes, KMS is offline`,
        "MEDIUM"
      );
      return res.status(400).send("An error has occurred");
    }
    const decryptionKey = await kms.getElectionPrivateKey(id);
    const decryptedVotes = [];
    for (const vote of votes.rows) {
      const decryptedVote = encryption.decrypt(
        vote.vote,
        decryptionKey.key,
        body.key,
        decryptionKey.iv,
        decryptionKey.tag
      );
      if (
        candidates.find((x) => x.id === decryptedVote) ||
        decryptedVote === "blank"
      ) {
        decryptedVotes.push(decryptedVote);
      } else {
        await logger.insertElectionLog(
          id,
          election[0].title,
          `Vote not matching any candidate has been found`,
          "MEDIUM"
        );
      }
    }
    let voteCount = {};
    const count = _.countBy(decryptedVotes);
    for (const c of candidates) {
      voteCount[c.id] = count[c.id] ? count[c.id] : 0;
    }
    voteCount["blank"] = count["blank"] ? count["blank"] : 0;
    const results = encryption.internalEncrypt(JSON.stringify(voteCount));
    await logger.insertElectionLog(
      id,
      election[0].title,
      `${username} ordered votes be counted`,
      "NONE"
    );
    await sequelize.query(
      "CALL insert_election_results(:id, :results, :detection);",
      {
        replacements: { id: id, results: results, detection: detection },
      }
    );
    await createReports(sanitize(id), voteCount);
    return res
      .status(200)
      .json({ message: "Counted with success", detection: detection });
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
      "SELECT results, pdf, xlsx, detection from e_vote_election WHERE id = :id;",
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
      encryption.internalDecrypt(results[0].results)
    );
    const candidateVotes = [];
    for (const candidate of candidates) {
      candidate["votes"] = decryptedResults[candidate.id];
      candidateVotes.push([candidate.name, decryptedResults[candidate.id]]);
    }
    candidateVotes.push([
      "Blank",
      decryptedResults["blank"] ? decryptedResults["blank"] : 0,
    ]);
    const voted = voters.filter((x) => x.voted !== null).length;
    const notVoted = voters.length - voted;
    candidates.push({
      name: "Blank",
      votes: decryptedResults["blank"] ? decryptedResults["blank"] : 0,
    });
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
      detection: results[0].detection,
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
      encryption.internalDecrypt(results[0].results)
    );
    const candidateVotes = [];
    for (const candidate of candidates) {
      candidate["votes"] = decryptedResults[candidate.id];
      candidateVotes.push([candidate.name, decryptedResults[candidate.id]]);
    }
    candidateVotes.push([
      "Blank",
      decryptedResults["blank"] ? decryptedResults["blank"] : 0,
    ]);
    const voted = voters.filter((x) => x.voted !== null).length;
    const notVoted = voters.length - voted;
    candidates.push({
      name: "Blank",
      votes: decryptedResults["blank"] ? decryptedResults["blank"] : 0,
    });
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
