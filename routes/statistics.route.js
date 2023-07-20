const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const statisticsController = require("../controllers/statistics.controller");

module.exports = (app) => {
  const statisticsController = require("../controllers/statistics.controller");
  router.post("/:id", auth, statisticsController.vote);
  router.post(
    "/count/:id",
    auth,
    access(["MANAGER"]),
    statisticsController.countVotes
  );
  router.get(
    "/status/:id",
    auth,
    access(["MANAGER"]),
    statisticsController.showStatus
  );
  router.get(
    "/results/:id",
    auth,
    access(["MANAGER"]),
    statisticsController.showResults
  );
  app.use("/vote", router);
};
