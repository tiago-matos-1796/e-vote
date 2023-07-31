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
const { client } = require("../configs/cassandra");
const fs = require("fs");
const sharp = require("sharp");
const moment = require("moment/moment");

// DONE
async function register(req, res, next) {
  const body = req.body;
  let image = req.file ? req.file.filename : null;
  try {
    if (!emailValidator.validate(body.email)) {
      fs.unlink(`files/images/avatars/${image}`, function (err) {
        if (err) {
          throw err;
        }
      });
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
    if (result.length > 0) {
      fs.unlink(`files/images/avatars/${image}`, function (err) {
        if (err) {
          throw err;
        }
      });
      return next(createError(409, `Email ${body.email} already in use`));
    }
    if (body.password.length < 8) {
      fs.unlink(`files/images/avatars/${image}`, function (err) {
        if (err) {
          throw err;
        }
      });
      return next(
        createError(400, `Password must have at least a length of 8`)
      );
    }
    if (body.sign_key.length !== 16) {
      fs.unlink(`files/images/avatars/${image}`, function (err) {
        if (err) {
          throw err;
        }
      });
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
        fs.unlink(`files/images/avatars/${image}`, function (err) {
          if (err) {
            throw err;
          }
        });
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
    await sequelize.query(
      "CALL insert_user (:id, :username, :email, :display_name, :image, :password, :permission, :token);",
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
        },
      }
    );
    return res.status(200).json({
      id: id,
      username: username,
      email: body.email,
      display_name: body.display_name,
      image: image,
      permission: "REGULAR",
      token: token,
    });
  } catch (err) {
    fs.unlink(`files/images/avatars/${image}`, function (err) {
      if (err) {
        throw err;
      }
    });
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
      "SELECT * from e_vote_user WHERE email = :email",
      {
        type: QueryTypes.SELECT,
        replacements: { email: body.email },
      }
    );
    const compare = await bcrypt.compare(body.password, user[0].password);
    if (user.length === 0 || !compare) {
      return next(createError(400, `Email and/or password is wrong`));
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
        "select id, username, email, display_name, permission from e_vote_user;",
        {
          type: QueryTypes.SELECT,
        }
      );
      return res.status(200).json(users);
    }
    if (user[0].permission === "MANAGER") {
      const users = await sequelize.query(
        "select id, email, display_name from e_vote_user;",
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
};
