const jwt = require("jsonwebtoken");
const db = require("../models");
const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const access = (permissions) => {
  return async (req, res, next) => {
    //const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const token = req.cookies.token;
    const id = jwt.decode(token).id;
    const user = await sequelize.query(
      "SELECT * FROM e_vote_user WHERE id = :id",
      {
        type: QueryTypes.SELECT,
        replacements: { id: id },
      }
    );
    if (!permissions.includes(user[0].permission)) {
      return res.status(403).send("Invalid permissions");
    } else {
      return next();
    }
  };
};

module.exports = { access };
