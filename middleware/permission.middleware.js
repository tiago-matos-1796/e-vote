const jwt = require("jsonwebtoken");
const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const access = (permissions) => {
  return async (req, res, next) => {
    const token = req.cookies.token;
    let id = "";
    jwt.verify(token, process.env.JWT_SECRET, {}, function (err, decoded) {
      if (err) {
        res.status(401).send("Invalid Token");
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
    if (!permissions.includes(user[0].permission)) {
      return res.status(403).send("Invalid permissions");
    } else {
      return next();
    }
  };
};

module.exports = { access };
