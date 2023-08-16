const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const uuid = require("uuid");
const { sequelize } = require("../models/index");
const encryption = require("../services/encryption.service");
const kms = require("../utils/kms.utils");
const { QueryTypes } = require("sequelize");
const uuidValidator = require("uuid-validate");
const { client } = require("../configs/cassandra.config");
const moment = require("moment");
const fs = require("fs");
const sharp = require("sharp");
const logger = require("../utils/log.utils");
const sanitizeImage = require("sanitize-filename");

async function listByVoter(req, res, next) {
  const token = req.cookies.token;
  let userId = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    userId = jwt.decode(token).id;
  } else {
    return next(createError(401, "Invalid Token"));
  }
  try {
    const elections = await sequelize.query(
      "select eve.id, eve.title, eve.start_date, eve.end_date, eve.created_at, eve.results, evv.voted from e_vote_election eve inner join e_vote_voter evv on eve.id = evv.election_id where evv.user_id = :id",
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
      election["results"] = election["results"] !== null;
    }
    return res.status(200).json(elections);
  } catch (err) {
    await logger.insertSystemLog(
      "/elections/voter",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function listByManager(req, res, next) {
  const token = req.cookies.token;
  let userId = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    userId = jwt.decode(token).id;
  } else {
    return next(createError(401, "Invalid Token"));
  }
  try {
    const elections = await sequelize.query(
      "select eve.id, eve.title, eve.start_date, eve.end_date, eve.created_at, eve.results from e_vote_election eve inner join e_vote_manager evm on eve.id = evm.election_id where evm.user_id = :id;",
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
      election["results"] = election["results"] !== null;
    }
    return res.status(200).json(elections);
  } catch (err) {
    await logger.insertSystemLog(
      "/elections/manager",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function showBallot(req, res, next) {
  const id = req.params.id;
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
    const candidates = election.map(function (item) {
      let image = item.image;
      if (image) {
        const file = fs.readFileSync(
          `files/images/candidate_images/${sanitizeImage(image)}`
        );
        image = Buffer.from(file).toString("base64");
      }
      return { id: item.id, name: item.name, image: image };
    });
    const electionObj = {
      id: election[0].election_id,
      title: election[0].title,
      election_key: electionPublicKey.key,
      hash_method: "sha512",
      candidates: candidates,
    };
    return res.status(200).json(electionObj);
  } catch (err) {
    await logger.insertSystemLog(
      "/elections/:id",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
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
      "select evu.id, evu.email, evu.display_name from e_vote_election eve join e_vote_voter evv on eve.id = evv.election_id inner join e_vote_user evu on evu.id = evv.user_id where eve.id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const nonVoters = await sequelize.query(
      "select u.id, u.display_name, u.email\n" +
        "from e_vote_user u left join (select evu.id, evu.display_name from e_vote_election eve join e_vote_voter evv on eve.id = evv.election_id inner join e_vote_user evu on evu.id = evv.user_id where eve.id = :id) b on u.id=b.id\n" +
        "where b.id is NULL and u.blocked = false AND activation_token IS NULL AND partial_activation_token IS NULL;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const electionManagers = await sequelize.query(
      "select evu.id, evu.display_name, evu.email from e_vote_election eve join e_vote_manager evm on eve.id = evm.election_id inner join e_vote_user evu on evu.id = evm.user_id where eve.id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const nonManagers = await sequelize.query(
      "select u.id, u.display_name, u.email\n" +
        "from e_vote_user u left join (select evu.id, evu.display_name from e_vote_election eve join e_vote_manager evm on eve.id = evm.election_id inner join e_vote_user evu on evu.id = evm.user_id where eve.id = :id) b on u.id=b.id\n" +
        "where b.id is NULL and u.permission = 'MANAGER' and u.blocked = false AND activation_token IS NULL AND partial_activation_token IS NULL;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const candidates = electionCandidates.map(function (item) {
      return { id: item.id, name: item.name, image: item.image };
    });
    const electionObj = {
      id: electionCandidates[0].election_id,
      title: electionCandidates[0].title,
      startDate: moment(
        electionCandidates[0].start_date,
        "DD-MM-YYYY HH:mm"
      ).format("YYYY-MM-DD HH:mm"),
      endDate: moment(
        electionCandidates[0].end_date,
        "DD-MM-YYYY HH:mm"
      ).format("YYYY-MM-DD HH:mm"),
      candidates: candidates,
      voters: electionVoters,
      nonVoters: nonVoters,
      managers: electionManagers,
      nonManagers: nonManagers,
    };
    return res.status(200).json(electionObj);
  } catch (err) {
    await logger.insertSystemLog(
      "/elections/manager/:id",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function create(req, res, next) {
  const body = req.body;
  const token = req.cookies.token;
  let userId = "";
  let username = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    userId = jwt.decode(token).id;
    username = jwt.decode(token).username;
  } else {
    return next(createError(401, "Invalid Token"));
  }
  if (body.candidates.length === 0) {
    for (const image of req.files) {
      fs.unlink(
        `files/images/candidate_images/${sanitizeImage(image.originalname)}`,
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
      keyPair.privateKey,
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
          await sharp(
            `files/images/candidate_images/${sanitizeImage(image.originalname)}`
          )
            .resize(300, 300)
            .toFormat("jpg")
            .toFile(`files/images/candidate_images/${fileName}`);
          fs.unlink(
            `files/images/candidate_images/${sanitizeImage(
              image.originalname
            )}`,
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
    if (body.voters) {
      for (const voter of body.voters) {
        await sequelize.query("CALL insert_voter (:user_id, :election_id);", {
          replacements: { user_id: voter, election_id: electionId },
          transaction,
        });
      }
    }
    await transaction.commit();
    const log =
      "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: electionId,
      election_title: body.title,
      log: `Election ${body.title} with ID: ${electionId} has been created by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(body);
  } catch (err) {
    await transaction.rollback();
    await logger.insertSystemLog("/elections/", err.message, err.stack, "POST");
    return res.status(500).send("An error has occurred");
  }
}

async function update(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.cookies.token;
  let username = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    username = jwt.decode(token).username;
  } else {
    return next(createError(401, "Invalid Token"));
  }
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
        moment(election[0].start_date, "DD-MM-YYYY HH:mm"),
        moment(election[0].end_date, "DD-MM-YYYY HH:mm")
      )
    ) {
      return next(createError(400, `Ongoing election`));
    }
    if (moment().isAfter(moment(election[0].end_date, "DD-MM-YYYY HH:mm"))) {
      return next(createError(400, `Election has ended`));
    }
    await sequelize.query(
      "CALL update_election (:id, :title, :startDate, :endDate);",
      {
        replacements: {
          id: id,
          title: body.title,
          startDate: moment(body.startDate, "YYYY-MM-DD HH:mm").format(
            "DD-MM-YYYY HH:mm"
          ),
          endDate: moment(body.endDate, "YYYY-MM-DD HH:mm").format(
            "DD-MM-YYYY HH:mm"
          ),
        },
        transaction,
      }
    );
    const candidates = await sequelize.query(
      "SELECT id, image from e_vote_candidate WHERE election_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    for (let candidate of body.candidates) {
      candidate = JSON.parse(candidate);
      if (candidate.hasOwnProperty("id")) {
        const index = candidates.findIndex((obj) => obj.id === candidate.id);
        if (candidate.image) {
          if (candidates[index].image === candidate.image) {
            await sequelize.query(
              "CALL update_candidate (:id, :name, :image);",
              {
                replacements: {
                  id: candidate.id,
                  name: candidate.name,
                  image: candidate.image,
                },
                transaction,
              }
            );
            candidates.splice(index, 1);
          } else {
            const fileName = `${Date.now()}-${Math.round(
              Math.random() * 1e9
            )}_${candidate.image}`;
            await sharp(`files/images/candidate_images/${candidate.image}`)
              .resize(300, 300)
              .toFormat("jpg")
              .toFile(`files/images/candidate_images/${fileName}`);
            fs.unlink(
              `files/images/candidate_images/${sanitizeImage(candidate.image)}`,
              function (err) {
                if (err) {
                  throw err;
                }
              }
            );
            await sequelize.query(
              "CALL update_candidate (:id, :name, :image);",
              {
                replacements: {
                  id: candidate.id,
                  name: candidate.name,
                  image: fileName,
                },
                transaction,
              }
            );
            if (candidates[index].image) {
              fs.unlink(
                `files/images/candidate_images/${sanitizeImage(
                  candidates[index].image
                )}`,
                function (err) {
                  if (err) {
                    throw err;
                  }
                }
              );
            }
            candidates.splice(index, 1);
          }
        } else {
          if (candidates[index].image) {
            fs.unlink(
              `files/images/candidate_images/${sanitizeImage(
                candidates[index].image
              )}`,
              function (err) {
                if (err) {
                  throw err;
                }
              }
            );
          }
          await sequelize.query("CALL update_candidate (:id, :name, :image);", {
            replacements: {
              id: candidate.id,
              name: candidate.name,
              image: candidate.image,
            },
            transaction,
          });
          candidates.splice(index, 1);
        }
      } else {
        if (candidate.image) {
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}_${
            candidate.image
          }`;
          await sharp(`files/images/candidate_images/${candidate.image}`)
            .resize(300, 300)
            .toFormat("jpg")
            .toFile(`files/images/candidate_images/${fileName}`);
          fs.unlink(
            `files/images/candidate_images/${sanitizeImage(candidate.image)}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
          await sequelize.query(
            "CALL insert_candidate (:id, :name, :image, :election_id);",
            {
              replacements: {
                id: uuid.v1(),
                name: candidate.name,
                image: fileName,
                election_id: id,
              },
              transaction,
            }
          );
        } else {
          await sequelize.query(
            "CALL insert_candidate (:id, :name, :image, :election_id);",
            {
              replacements: {
                id: uuid.v1(),
                name: candidate.name,
                image: candidate.image,
                election_id: id,
              },
              transaction,
            }
          );
        }
      }
    }
    for (const candidate of candidates) {
      await sequelize.query("CALL delete_candidate (:id);", {
        replacements: {
          id: candidate.id,
        },
        transaction,
      });
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
      "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      election_title: body.title,
      log: `Election ${body.title} with ID: ${id} has been updated by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(body);
  } catch (err) {
    await transaction.rollback();
    await logger.insertSystemLog(
      "/elections/:id",
      err.message,
      err.stack,
      "PUT"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function remove(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  let username = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    username = jwt.decode(token).username;
  } else {
    return next(createError(401, "Invalid Token"));
  }
  const transaction = await sequelize.transaction();
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
    const candidateImages = await sequelize.query(
      "SELECT image from e_vote_candidate WHERE election_id = :id AND image is not null",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (
      moment().isBetween(
        moment(election[0].start_date, "DD-MM-YYYY HH:mm"),
        moment(election[0].end_date, "DD-MM-YYYY HH:mm")
      )
    ) {
      return next(createError(400, `Ongoing election`));
    }
    if (moment().isAfter(moment(election[0].end_date, "DD-MM-YYYY HH:mm"))) {
      return next(createError(400, `Election has ended`));
    }
    for (const image of candidateImages) {
      fs.unlink(
        `files/images/candidate_images/${sanitizeImage(image.image)}`,
        function (err) {
          if (err) {
            console.log(err);
          }
        }
      );
    }
    await sequelize.query("CALL delete_election_candidates (:id)", {
      replacements: { id: id },
      transaction,
    });
    await sequelize.query("CALL delete_election_managers (:id)", {
      replacements: { id: id },
      transaction,
    });
    await sequelize.query("CALL delete_election_voters (:id)", {
      replacements: { id: id },
      transaction,
    });
    await sequelize.query("CALL delete_election (:id)", {
      replacements: { id: id },
      transaction,
    });
    await kms.deleteElectionKeys(id);
    const log =
      "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      election_title: election[0].title,
      log: `Election with ID: ${id} has been deleted by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    await transaction.commit();
    return res.status(200).json(1);
  } catch (err) {
    await transaction.rollback();
    await logger.insertSystemLog(
      "/elections/:id",
      err.message,
      err.stack,
      "DELETE"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function regenerateKeys(req, res, next) {
  const id = req.params.id;
  const body = req.body;
  const token = req.cookies.token;
  let username = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    username = jwt.decode(token).username;
  } else {
    return next(createError(401, "Invalid Token"));
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
        moment(election[0].start_date, "DD-MM-YYYY HH:mm"),
        moment(election[0].end_date, "DD-MM-YYYY HH:mm")
      )
    ) {
      return next(createError(400, `Ongoing election`));
    }
    if (moment().isAfter(moment(election[0].end_date, "DD-MM-YYYY HH:mm"))) {
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
      "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      election_id: id,
      election_title: election[0].title,
      log: ` Keys have been regenerated for election with ID: ${id} by user ${username}`,
      severity: "NONE",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(1);
  } catch (err) {
    await logger.insertSystemLog(
      "/elections/:id",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function createSignature(req, res, next) {
  const body = req.body;
  const token = req.cookies.token;
  let userId = "";
  if (jwt.verify(token, process.env.JWT_SECRET)) {
    userId = jwt.decode(token).id;
  } else {
    return next(createError(401, "Invalid Token"));
  }
  try {
    const signaturePrivateKey = await kms.getSignaturePrivateKey(userId);
    const signature = encryption.sign(
      Buffer.from(body.data),
      signaturePrivateKey.key,
      body.key,
      signaturePrivateKey.iv
    );
    return res.status(200).json({ data: signature });
  } catch (err) {
    await logger.insertSystemLog(
      "/elections/signature",
      err.message,
      err.stack,
      "POST"
    );
    return res.status(500).send("An error has occurred");
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
  createSignature,
};
