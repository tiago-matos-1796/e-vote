const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { limit } = require("express-limit");

module.exports = (app) => {
  const logController = require("../controllers/log.controller");
  router.get(
    "/",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["AUDITOR"]),
    logController.show
  );
  app.use("/log", router);
};
