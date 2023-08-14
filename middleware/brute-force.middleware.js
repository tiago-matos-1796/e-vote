const ExpressBrute = require("express-brute");
const SequelizeStore = require("express-brute-sequelize");
const { sequelize } = require("../models/index");

const store = new SequelizeStore(sequelize, "bruteforce", {});
const bruteforce = new ExpressBrute(store);

module.exports = { bruteforce };
