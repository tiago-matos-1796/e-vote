const kms = require("../utils/kms.utils");
const crypto = require("crypto");
const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("dotenv").config().parsed;
const uuid = require("uuid");
const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const emailValidator = require("email-validator");
const uuidValidator = require("uuid-validate");
const bcrypt = require("bcrypt");
const permissions = ["ADMIN", "MANAGER", "AUDITOR", "REGULAR"];
const encryption = require("../services/encryption.service");
const { client } = require("../configs/cassandra.config");
const fs = require("fs");
const sharp = require("sharp");
const moment = require("moment/moment");
const { transporter } = require("../configs/smtp.config");

// DONE
async function register(req, res, next) {
  const body = req.body;
  let image = req.file ? req.file.filename : null;
  try {
    if (!emailValidator.validate(body.email)) {
      if (image) {
        fs.unlink(`files/images/avatars/${image}`, function (err) {
          if (err) {
            throw err;
          }
        });
      }
      return next(
        createError(400, `Email ${body.email} is not in correct format`)
      );
    }
    const result = await sequelize.query(
      "SELECT * from e_vote_user WHERE email=:email;",
      {
        type: QueryTypes.SELECT,
        replacements: { email: body.email },
      }
    );
    const blacklist = await sequelize.query(
      "SELECT email from e_vote_blacklist",
      {
        type: QueryTypes.SELECT,
      }
    );
    if (blacklist.length > 0) {
      const bEmail = blacklist.find((x) => x.email === body.email);
      if (bEmail) {
        if (image) {
          fs.unlink(`files/images/avatars/${image}`, function (err) {
            if (err) {
              throw err;
            }
          });
        }
        return next(
          createError(400, `Email ${body.email} is not permitted to register`)
        );
      }
    }
    if (result.length > 0) {
      if (image) {
        fs.unlink(`files/images/avatars/${image}`, function (err) {
          if (err) {
            throw err;
          }
        });
      }
      return next(createError(409, `Email ${body.email} already in use`));
    }
    if (body.password.length < 8) {
      if (image) {
        fs.unlink(`files/images/avatars/${image}`, function (err) {
          if (err) {
            throw err;
          }
        });
      }
      return next(
        createError(400, `Password must have at least a length of 8`)
      );
    }
    if (body.sign_key.length !== 16) {
      if (image) {
        fs.unlink(`files/images/avatars/${image}`, function (err) {
          if (err) {
            throw err;
          }
        });
      }
      return next(createError(400, `Signature key must have a length of 16`));
    }
    const keys = encryption.generateSignatureKeys(body.sign_key);
    const username = body.email.split("@")[0];
    const password = await bcrypt.hash(body.password, 13);
    const id = uuid.v1();
    const token = jwt.sign({ id: id, username: username }, config.JWT_SECRET);
    const key = await kms.insertSignature(
      id,
      keys.publicKey,
      keys.privateKey,
      keys.iv
    );
    if (key.status !== 201) {
      if (key.status === 400) {
        if (image) {
          fs.unlink(`files/images/avatars/${image}`, function (err) {
            if (err) {
              throw err;
            }
          });
        }
        return next(createError(400, `Duplicate key`));
      } else {
        return res.status(500).send("Error inserting user keys");
      }
    }
    if (image) {
      const fileName = `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}_${image}`;
      await sharp(`files/images/avatars/${image}`)
        .resize(180, 180)
        .toFormat("jpg")
        .toFile(`files/images/avatars/${fileName}`);
      fs.unlink(`files/images/avatars/${image}`, function (err) {
        if (err) {
          throw err;
        }
      });
      image = fileName;
    }
    const activation_token = crypto
      .createHash("sha256")
      .update(Date.now().toString())
      .digest("base64");
    await sequelize.query(
      "CALL insert_user (:id, :username, :email, :display_name, :image, :password, :permission, :token, :verification);",
      {
        replacements: {
          id: id,
          username: username,
          email: body.email,
          display_name: body.display_name,
          image: image,
          password: password,
          permission: "REGULAR",
          token: token,
          verification: activation_token,
        },
      }
    );
    const link = `http://localhost:5173/verification/${activation_token}`;
    const mailOptions = {
      from: "UAlg Secure Vote",
      to: body.email,
      subject: "Register",
      text: "Thank you for registering in UAlg secure vote",
      html: `<b>Hey ${body.display_name}! </b><br> Thank you for registering in UAlg secure vote<br>Please use the following link to verify your account:<br><a href="${link}">${link}</a>`,
    };
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log("Message sent: %s", info.messageId);
    });
    return res.status(200).json(1);
  } catch (err) {
    fs.unlink(`files/images/avatars/${image}`, function (err) {
      if (err) {
        throw err;
      }
    });
    throw err;
  }
}

async function verify(req, res, next) {
  const token = req.params.token;
  try {
    const account = await sequelize.query(
      "SELECT * FROM e_vote_user WHERE activation_token = :token",
      {
        type: QueryTypes.SELECT,
        replacements: { token: token },
      }
    );
    if (account.length === 0) {
      return next(createError(400, "Token does not exist"));
    }
    await sequelize.query("CALL verify_account (:token);", {
      type: QueryTypes.SELECT,
      replacements: { token: token },
    });
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

// DONE
async function login(req, res, next) {
  const body = req.body;
  try {
    if (!emailValidator.validate(body.email)) {
      return next(
        createError(400, `Email ${body.email} is not in correct format`)
      );
    }
    let user = await sequelize.query(
      "SELECT * from e_vote_user WHERE email = :email AND blocked = false",
      {
        type: QueryTypes.SELECT,
        replacements: { email: body.email },
      }
    );

    if (user.length === 0) {
      return next(
        createError(
          403,
          "Account temporarily unavailable, please try again later"
        )
      );
    } else {
      const compare = await bcrypt.compare(body.password, user[0].password);
      if (!compare) {
        return next(createError(400, `Email and/or password is wrong`));
      }
    }
    if (user[0].activation_token) {
      return next(createError(406, `Account not yet active`));
    }
    user = user[0];
    return res.status(200).json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      image: user.image,
      permissions: user.permission,
      token: user.token,
    });
  } catch (err) {
    throw err;
  }
}

// DONE
async function update(req, res, next) {
  const id = req.params.id;
  const file = req.file;
  const body = req.body;
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  if (id !== userId) {
    return next(createError(403, "Access Denied"));
  }
  try {
    if (!uuidValidator(id, 1)) {
      return next(createError(400, `id ${id} cannot be validated`));
    }
    const user = await sequelize.query(
      "SELECT * from e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (user.length === 0) {
      return next(createError(404, `User ${id} not found`));
    }
    let imageName = "";
    if (body.avatar === "true") {
      if (file) {
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}_${
          file.filename
        }`;
        await sharp(`files/images/avatars/${file.filename}`)
          .resize(180, 180)
          .toFormat("jpg")
          .toFile(`files/images/avatars/${fileName}`);
        fs.unlink(`files/images/avatars/${file.filename}`, function (err) {
          if (err) {
            throw err;
          }
        });
        if (user[0].image) {
          fs.unlink(`files/images/avatars/${user[0].image}`, function (err) {
            if (err) {
              throw err;
            }
          });
        }
        imageName = fileName;
      } else {
        if (user[0].image) {
          fs.unlink(`files/images/avatars/${user[0].image}`, function (err) {
            if (err) {
              throw err;
            }
          });
        }
        imageName = null;
      }
    } else {
      imageName = user[0].image;
    }
    const password =
      body.password.length > 0
        ? await bcrypt.hash(body.password, 13)
        : user[0].password;
    await sequelize.query(
      "CALL update_user (:id, :display_name, :password, :image);",
      {
        replacements: {
          id: id,
          display_name: body.displayName,
          password: password,
          image: imageName,
        },
      }
    );
    return res
      .status(200)
      .json({ display_name: body.displayName, image: imageName });
  } catch (err) {
    throw err;
  }
}

// TODO check if user belongs to an active election, do not delete if its the case
async function remove(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  if (id !== userId) {
    return next(createError(403, "Access Denied"));
  }
  try {
    if (!uuidValidator(id, 1)) {
      return next(createError(400, `id ${id} cannot be validated`));
    }
    const user = await sequelize.query(
      "SELECT * from e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (user.length === 0) {
      return next(createError(404, `User ${id} not found`));
    }
    if (user[0].image) {
      fs.unlink(`files/images/avatars/${user[0].image}`, function (err) {
        if (err) {
          throw err;
        }
      });
    }
    await sequelize.query("CALL delete_user (:id);", {
      replacements: { id: id },
    });
    await kms.deleteSignatureKeys(userId);
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

async function adminUserDelete(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  try {
    if (!uuidValidator(id, 1)) {
      return next(createError(400, `id ${id} cannot be validated`));
    }
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: jwt.decode(token).id },
      }
    );
    const user = await sequelize.query(
      "SELECT * from e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const voter = await sequelize.query(
      "select count(*) from e_vote_voter where user_id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (voter[0].count > 0) {
      return next(
        createError(400, `User ${id} is voter in at least 1 election`)
      );
    }
    if (user.length === 0) {
      return next(createError(404, `User ${id} not found`));
    }
    await sequelize.query("CALL delete_user (:id);", {
      replacements: { id: id },
    });
    const log =
      "INSERT INTO internal_log (id, log_creation, log, type) VALUES (:id, :log_creation, :log, :type)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      log: `${admin[0].username} deleted user ${user[0].username}`,
      type: "USER",
    };
    await client.execute(log, logParams, { prepare: true });
    await kms.deleteSignatureKeys(userId);
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

async function show(req, res, next) {
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  try {
    const profile = await sequelize.query(
      "select username, email, display_name, image from e_vote_user where id = :id;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: userId },
      }
    );
    if (profile.length === 0) {
      return next(createError(404, `User ${userId} not found`));
    }
    return res.status(200).json(profile[0]);
  } catch (err) {
    throw err;
  }
}

async function showUsers(req, res, next) {
  try {
    const token = req.cookies.token;
    const id = jwt.decode(token).id;
    const user = await sequelize.query(
      "SELECT * FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (user[0].permission === "ADMIN") {
      const users = await sequelize.query(
        "select id, username, email, display_name, permission, blocked from e_vote_user;",
        {
          type: QueryTypes.SELECT,
        }
      );
      return res.status(200).json(users);
    }
    if (user[0].permission === "MANAGER") {
      const users = await sequelize.query(
        "select id, email, display_name from e_vote_user where blocked = false;",
        {
          type: QueryTypes.SELECT,
        }
      );
      return res.status(200).json(users);
    }
  } catch (err) {
    throw err;
  }
}

// DONE
async function changePermissions(req, res, next) {
  const id = req.params.id; // id of user in which permissions will be changed
  const permission = req.body.permission;
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  if (!permissions.includes(permission)) {
    return next(
      createError(400, `Permission ${permission} is not a valid permission`)
    );
  }
  const token = req.cookies.token;
  try {
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: jwt.decode(token).id },
      }
    );
    const user = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (user.length === 0) {
      return next(createError(404, `User ${id} not found`));
    }
    const oldPermission = user[0].permission;
    await sequelize.query("CALL change_user_permission(:id, :permission);", {
      replacements: { id: id, permission: permission },
    });
    const log =
      "INSERT INTO internal_log (id, log_creation, log, type) VALUES (:id, :log_creation, :log, :type)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      log: `${admin[0].username} changed permission of ${user[0].username} from ${oldPermission} to ${permission}`,
      type: "USER",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json({ id: id, permission: permission });
  } catch (err) {
    throw err;
  }
}

async function regenerateKeys(req, res, next) {
  const token = req.cookies.token;
  const userId = jwt.decode(token).id;
  const body = req.body;
  try {
    const keyPair = encryption.generateSignatureKeys(body.key);
    await kms.updateSignatureKeys(
      userId,
      keyPair.publicKey,
      keyPair.privateKey,
      keyPair.iv
    );
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

async function blockUser(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  try {
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: jwt.decode(token).id },
      }
    );
    const user = await sequelize.query(
      "SELECT * from e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const election = await sequelize.query(
      "select eve.id, eve.title from e_vote_election eve inner join e_vote_voter evv on eve.id = evv.election_id where evv.user_id = :id and eve.results IS NULL;",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (user[0].length === 0) {
      return next(createError(404, `User ${id} does not exist`));
    }
    if (election[0].length > 0) {
      return next(
        createError(
          404,
          `Cannot block User ${id}; User is voter in ongoing elections`
        )
      );
    }
    await sequelize.query("CALL block_user (:id);", {
      replacements: { id: id },
    });
    const log =
      "INSERT INTO internal_log (id, log_creation, log, type) VALUES (:id, :log_creation, :log, :type)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      log: `${admin[0].username} blocked ${user[0].username}`,
      type: "USER",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

async function unblockUser(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  try {
    const user = await sequelize.query(
      "SELECT * from e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: jwt.decode(token).id },
      }
    );
    if (user[0].length === 0) {
      return next(createError(404, `User ${id} does not exist`));
    }
    await sequelize.query("CALL unblock_user (:id);", {
      replacements: { id: id },
    });
    const log =
      "INSERT INTO internal_log (id, log_creation, log, type) VALUES (:id, :log_creation, :log, :type)";
    const logParams = {
      id: uuid.v1(),
      log_creation: moment().format("DD-MM-YYYY HH:mm"),
      log: `${admin[0].username} unblocked ${user[0].username}`,
      type: "USER",
    };
    await client.execute(log, logParams, { prepare: true });
    return res.status(200).json(1);
  } catch (err) {
    throw err;
  }
}

module.exports = {
  register,
  login,
  update,
  remove,
  show,
  showUsers,
  changePermissions,
  regenerateKeys,
  adminUserDelete,
  blockUser,
  unblockUser,
  verify,
};
