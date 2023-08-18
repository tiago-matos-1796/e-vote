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
const fs = require("fs");
const sharp = require("sharp");
const { transporter } = require("../configs/smtp.config");
const logger = require("../utils/log.utils");
const sanitizeImage = require("sanitize-filename");

async function register(req, res, next) {
  const body = req.body;
  let image = req.file ? req.file.filename : null;
  try {
    if (!emailValidator.validate(body.email)) {
      if (image) {
        fs.unlink(
          `files/images/avatars/${sanitizeImage(image)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
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
          fs.unlink(
            `files/images/avatars/${sanitizeImage(image)}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
        }
        return next(
          createError(400, `Email ${body.email} is not permitted to register`)
        );
      }
    }
    if (result.length > 0) {
      if (image) {
        fs.unlink(
          `files/images/avatars/${sanitizeImage(image)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
      }
      return next(createError(409, `Email ${body.email} already in use`));
    }
    if (typeof body.password === "string") {
      if (body.password.length < 8) {
        if (image) {
          fs.unlink(
            `files/images/avatars/${sanitizeImage(image)}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
        }
        return next(
          createError(400, `Password must have at least a length of 8`)
        );
      }
    }
    if (typeof body.sign_key === "string") {
      if (body.sign_key.length !== 16) {
        if (image) {
          fs.unlink(
            `files/images/avatars/${sanitizeImage(image)}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
        }
        return next(createError(400, `Signature key must have a length of 16`));
      }
    }
    const kms_conn = await kms.kmsConnection();
    if (kms_conn) {
      const keys = encryption.generateSignatureKeys(body.sign_key);
      const username =
        typeof body.email === "string"
          ? body.email.split("@")[0] + Date.now().toString()
          : "user" + Date.now().toString();
      const password = await bcrypt.hash(body.password, 13);
      const id = uuid.v1();
      const token = jwt.sign({ id: id, username: username }, config.JWT_SECRET);
      const key = await kms.insertSignature(
        id,
        keys.publicKey,
        keys.privateKey,
        keys.iv,
        keys.tag
      );
      if (key.status !== 201) {
        if (key.status === 400) {
          if (image) {
            fs.unlink(
              `files/images/avatars/${sanitizeImage(image)}`,
              function (err) {
                if (err) {
                  throw err;
                }
              }
            );
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
        fs.unlink(
          `files/images/avatars/${sanitizeImage(image)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
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
      const link = `${process.env.FRONTEND_URI}/verification?token=${activation_token}`;
      const mailOptions = {
        from: "UAlg Secure Vote",
        to: body.email,
        subject: "Register",
        text: "Thank you for registering in UAlg secure vote",
        html: `<b>Hey ${body.display_name}! </b><br> Thank you for registering in UAlg secure vote<br>Please use the following link to verify your account:<br><a href="${link}">${link}</a>`,
      };
      await transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          throw err;
        }
      });
      return res.status(200).json(1);
    } else {
      if (image) {
        fs.unlink(
          `files/images/avatars/${sanitizeImage(image)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
      }
      return res.status(500).send("An error has occurred");
    }
  } catch (err) {
    fs.unlink(`files/images/avatars/${sanitizeImage(image)}`, function (err) {
      if (err) {
        throw err;
      }
    });
    await logger.insertSystemLog("/users/", err.message, err.stack, "POST");
    return res.status(500).send("An error has occurred");
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
    await logger.insertSystemLog(
      "/users/verify/:token",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
  }
}

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
      displayName: user.display_name,
      username: user.username,
      image: user.image,
      permissions: user.permission,
      token: user.token,
    });
  } catch (err) {
    await logger.insertSystemLog(
      "/users/login",
      err.message,
      err.stack,
      "POST"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function forgotPassword(req, res, next) {
  const body = req.body;
  try {
    const user = await sequelize.query(
      "SELECT * from e_vote_user WHERE email = :email",
      {
        type: QueryTypes.SELECT,
        replacements: { email: body.email },
      }
    );
    if (user.length === 0) {
      return next(createError(404, `Email ${body.email} not found`));
    }
    const token = crypto
      .createHash("sha256")
      .update(Date.now().toString())
      .digest("base64");
    await sequelize.query("CALL insert_reset_token (:email, :token);", {
      replacements: {
        email: body.email,
        token: token,
      },
    });
    const link = `http://localhost:5173/recovery?token=${token}`;
    const mailOptions = {
      from: "UAlg Secure Vote",
      to: body.email,
      subject: "Password recovery",
      html: `<b>Hey ${user[0].display_name}! </b><br>To recover your password please use the following link:<br><a href="${link}">${link}</a><br>Thank you!`,
    };
    await transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log("Message sent: %s", info.messageId);
    });
    return res.status(200).json(1);
  } catch (err) {
    await logger.insertSystemLog(
      "/users/forgot-password",
      err.message,
      err.stack,
      "POST"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function passwordRecovery(req, res, next) {
  const token = req.params.token;
  const body = req.body;
  try {
    if (token) {
      const user = await sequelize.query(
        "SELECT * from e_vote_user WHERE reset_token = :token;",
        {
          type: QueryTypes.SELECT,
          replacements: { token: token },
        }
      );
      if (user.length === 0) {
        return next(createError(404, "Token could not be verified"));
      }
      const password = await bcrypt.hash(body.password, 13);
      await sequelize.query("CALL password_recovery ( :password, :token);", {
        type: QueryTypes.SELECT,
        replacements: {
          password: password,
          token: token,
        },
      });
      return res.status(200).json(1);
    } else {
      return next(createError(400, "Token is required"));
    }
  } catch (err) {
    await logger.insertSystemLog(
      "/users/password-recovery/:token",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function update(req, res, next) {
  const id = req.params.id;
  const file = req.file;
  const body = req.body;
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
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
        fs.unlink(
          `files/images/avatars/${sanitizeImage(file.filename)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
        if (user[0].image) {
          fs.unlink(
            `files/images/avatars/${sanitizeImage(user[0].image)}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
        }
        imageName = fileName;
      } else {
        if (user[0].image) {
          fs.unlink(
            `files/images/avatars/${sanitizeImage(user[0].image)}`,
            function (err) {
              if (err) {
                throw err;
              }
            }
          );
        }
        imageName = null;
      }
    } else {
      imageName = user[0].image;
    }
    if (typeof body.password === "string") {
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
    }
    return res
      .status(200)
      .json({ display_name: body.displayName, image: imageName });
  } catch (err) {
    await logger.insertSystemLog("/users/:id", err.message, err.stack, "PUT");
    return res.status(500).send("An error has occurred");
  }
}

async function remove(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
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
      fs.unlink(
        `files/images/avatars/${sanitizeImage(user[0].image)}`,
        function (err) {
          if (err) {
            throw err;
          }
        }
      );
    }
    const kmsConn = await kms.kmsConnection();
    if (kmsConn) {
      await sequelize.query("CALL delete_user (:id);", {
        replacements: { id: id },
      });
      await kms.deleteSignatureKeys(userId);
      return res.status(200).json(1);
    } else {
      return res.status(500).send("An error has occurred");
    }
  } catch (err) {
    await logger.insertSystemLog(
      "/users/:id",
      err.message,
      err.stack,
      "DELETE"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function adminUserDelete(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
  try {
    if (!uuidValidator(id, 1)) {
      return next(createError(400, `id ${id} cannot be validated`));
    }
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: userId },
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
    const kmsConn = await kms.kmsConnection();
    if (kmsConn) {
      await sequelize.query("CALL delete_user (:id);", {
        replacements: { id: id },
      });
      await logger.insertInternalLog(
        `${admin[0].username} deleted user ${user[0].username}`
      );
      await kms.deleteSignatureKeys(userId);
      return res.status(200).json(1);
    } else {
      return res.status(500).send("An error has occurred");
    }
  } catch (err) {
    await logger.insertSystemLog(
      "/users/admin/:id",
      err.message,
      err.stack,
      "DELETE"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function show(req, res, next) {
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
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
    await logger.insertSystemLog(
      "/users/profile",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function showUsers(req, res, next) {
  try {
    const token = req.cookies.token;
    let id = "";
    jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
      if (err) {
        return next(createError(401, "Invalid Token"));
      } else {
        id = decoded.id;
      }
    });
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
      const blacklist = await sequelize.query(
        "select email from e_vote_blacklist",
        {
          type: QueryTypes.SELECT,
        }
      );
      return res.status(200).json({ users: users, blacklist: blacklist });
    }
    if (user[0].permission === "MANAGER") {
      const users = await sequelize.query(
        "select id, email, display_name from e_vote_user where blocked = false AND activation_token IS NULL AND partial_activation_token IS NULL;",
        {
          type: QueryTypes.SELECT,
        }
      );
      return res.status(200).json(users);
    }
  } catch (err) {
    await logger.insertSystemLog(
      "/users/user-list",
      err.message,
      err.stack,
      "GET"
    );
    return res.status(500).send("An error has occurred");
  }
}

// DONE
async function changePermissions(req, res, next) {
  const id = req.params.id; // id of user in which permissions will be changed
  const token = req.cookies.token;
  const permission = req.body.permission;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
  if (!uuidValidator(id, 1)) {
    return next(createError(400, `id ${id} cannot be validated`));
  }
  if (!permissions.includes(permission)) {
    return next(
      createError(400, `Permission ${permission} is not a valid permission`)
    );
  }
  try {
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: userId },
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
    await logger.insertInternalLog(
      `${admin[0].username} changed permission of ${user[0].username} from ${oldPermission} to ${permission}`
    );
    return res.status(200).json({ id: id, permission: permission });
  } catch (err) {
    await logger.insertSystemLog(
      "/users/admin/:id",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function regenerateKeys(req, res, next) {
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
  const body = req.body;
  try {
    const kmsConn = await kms.kmsConnection();
    if (kmsConn) {
      const keyPair = encryption.generateSignatureKeys(body.key);
      const key = await kms.updateSignatureKeys(
        userId,
        keyPair.publicKey,
        keyPair.privateKey,
        keyPair.iv,
        keyPair.tag
      );
      if (key.status === 200) {
        return res.status(200).json(1);
      } else {
        return res.status(500).send("An error has occurred");
      }
    } else {
      return res.status(500).send("An error has occurred");
    }
  } catch (err) {
    await logger.insertSystemLog("/users/key", err.message, err.stack, "POST");
    return res.status(500).send("An error has occurred");
  }
}

async function blockUser(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
  try {
    const admin = await sequelize.query(
      "SELECT id, username, permission FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: userId },
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
    await logger.insertInternalLog(
      `${admin[0].username} blocked ${user[0].username}`
    );
    return res.status(200).json(1);
  } catch (err) {
    await logger.insertSystemLog(
      "/users/admin/block/:id",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function unblockUser(req, res, next) {
  const id = req.params.id;
  const token = req.cookies.token;
  let userId = "";
  jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
    if (err) {
      return next(createError(401, "Invalid Token"));
    } else {
      userId = decoded.id;
    }
  });
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
        replacements: { id: userId },
      }
    );
    if (user[0].length === 0) {
      return next(createError(404, `User ${id} does not exist`));
    }
    await sequelize.query("CALL unblock_user (:id);", {
      replacements: { id: id },
    });
    await logger.insertInternalLog(
      `${admin[0].username} unblocked ${user[0].username}`
    );
    return res.status(200).json(1);
  } catch (err) {
    await logger.insertSystemLog(
      "/users/admin/unblock/:id",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function blacklistEmails(req, res, next) {
  const body = req.body;
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query("CALL delete_blacklist();", {
      transaction,
    });
    for (const email of body.blacklist) {
      await sequelize.query("CALL insert_blacklisted_user (:email);", {
        replacements: { email: email.email },
        transaction,
      });
    }
    await transaction.commit();
    return res.status(200).json(1);
  } catch (err) {
    await transaction.rollback();
    await logger.insertSystemLog(
      "/users/admin/blacklist",
      err.message,
      err.stack,
      "POST"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function bulkRegister(req, res, next) {
  const body = req.body;
  const transaction = await sequelize.transaction();
  try {
    const generatedUser = [];
    const dbUsers = await sequelize.query("SELECT email from e_vote_user;", {
      type: QueryTypes.SELECT,
    });
    const newUser = [];
    if (Array.isArray(dbUsers) && Array.isArray(body)) {
      for (let i = 0; i < body.length; i++) {
        let user = "";
        if (typeof body[i] === "string") {
          user = dbUsers.find((x) => x.email === body[i]);
        }
        if (typeof body[i] === "object") {
          user = dbUsers.find((x) => x.email === body[i].email);
        }
        if (!user) {
          newUser.push(body[i]);
        }
      }
    } else {
      return res.status(500).send("An error has occurred");
    }
    for (const user of newUser) {
      const id = uuid.v1();
      let username = "";
      let permission = "";
      let token = "";
      const activation_token = crypto
        .createHash("sha256")
        .update(Date.now().toString())
        .digest("base64");
      if (typeof user === "string") {
        username = user.split("@")[0] + Date.now().toString();
        permission = "REGULAR";
        token = jwt.sign(
          { id: id, username: username },
          process.env.JWT_SECRET
        );
        await sequelize.query(
          "CALL partial_insert_user (:id, :username, :email, :permission, :token, :activation_token);",
          {
            replacements: {
              id: id,
              username: username,
              email: user,
              permission: permission,
              token: token,
              activation_token: activation_token,
            },
            transaction,
          }
        );
        generatedUser.push({ email: user, activation_token: activation_token });
      }
      if (typeof user === "object") {
        username = user.email.split("@")[0] + Date.now().toString();
        permission = user.permission;
        if (!permissions.includes(permission)) {
          await transaction.rollback();
          return res
            .status(400)
            .send(
              `Error: Not accepted permission detected; Only REGULAR, MANAGER, AUDITOR and ADMIN are accepted`
            );
        }
        token = jwt.sign(
          { id: id, username: username },
          process.env.JWT_SECRET
        );
        await sequelize.query(
          "CALL partial_insert_user (:id, :username, :email, :permission, :token, :activation_token);",
          {
            replacements: {
              id: id,
              username: username,
              email: user.email,
              permission: permission,
              token: token,
              activation_token: activation_token,
            },
            transaction,
          }
        );
        generatedUser.push({
          email: user.email,
          activation_token: activation_token,
        });
      }
    }
    await transaction.commit();
    for (const genUser of generatedUser) {
      const link = `${process.env.FRONTEND_URI}/register-confirm?token=${genUser.activation_token}`;
      const mailOptions = {
        from: "UAlg Secure Vote",
        to: genUser.email,
        subject: "Register",
        text: "Thank you for registering in UAlg secure vote",
        html: `<b>Hey ${genUser.email}! </b><br> Thank you for registering in UAlg secure vote<br>Please use the following link to complete your registration:<br><a href="${link}">${link}</a>`,
      };
      await transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }
        console.log("Message sent: %s", info.messageId);
      });
    }
    return res.status(200).send("Inserted with success");
  } catch (err) {
    await transaction.rollback();
    await logger.insertSystemLog(
      "/users/bulk-register",
      err.message,
      err.stack,
      "POST"
    );
    return res.status(500).send("An error has occurred");
  }
}

async function partialRegister(req, res, next) {
  const token = req.params.token;
  const body = req.body;
  let image = req.file ? req.file.filename : null;
  try {
    const user = await sequelize.query(
      "SELECT * FROM e_vote_user WHERE partial_activation_token = :token;",
      {
        type: QueryTypes.SELECT,
        replacements: {
          token: token,
        },
      }
    );
    if (user.length === 0) {
      return next(createError(404, "Token not found"));
    }
    const kmsConn = await kms.kmsConnection();
    if (kmsConn) {
      const keys = encryption.generateSignatureKeys(body.sign_key);
      const password = await bcrypt.hash(body.password, 13);
      const key = await kms.insertSignature(
        user[0].id,
        keys.publicKey,
        keys.privateKey,
        keys.iv,
        keys.tag
      );
      if (key.status !== 201) {
        if (key.status === 400) {
          if (image) {
            fs.unlink(
              `files/images/avatars/${sanitizeImage(image)}`,
              function (err) {
                if (err) {
                  throw err;
                }
              }
            );
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
        fs.unlink(
          `files/images/avatars/${sanitizeImage(image)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
        image = fileName;
      }
      await sequelize.query(
        "CALL register_user (:displayName, :password, :image, :token);",
        {
          replacements: {
            displayName: body.display_name,
            password: password,
            image: image,
            token: token,
          },
        }
      );
      return res.status(200).json(1);
    } else {
      if (image) {
        fs.unlink(
          `files/images/avatars/${sanitizeImage(image)}`,
          function (err) {
            if (err) {
              throw err;
            }
          }
        );
      }
      return res.status(500).send("An error has occurred");
    }
  } catch (err) {
    await logger.insertSystemLog(
      "/users/register/:token",
      err.message,
      err.stack,
      "PATCH"
    );
    return res.status(500).send("An error has occurred");
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
  forgotPassword,
  passwordRecovery,
  blacklistEmails,
  bulkRegister,
  partialRegister,
};
