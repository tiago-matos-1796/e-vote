const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { bruteforce } = require("../middleware/brute-force.middleware");

module.exports = (app) => {
  const logController = require("../controllers/log.controller");
  router.get(
    "/",
    bruteforce.prevent,
    auth,
    access(["AUDITOR"]),
    logController.show
  );
  app.use("/log", router);
};
