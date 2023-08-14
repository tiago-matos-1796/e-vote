const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { bruteforce } = require("../middleware/brute-force.middleware");

module.exports = (app) => {
  const statisticsController = require("../controllers/statistics.controller");
  router.post("/:id", bruteforce.prevent, auth, statisticsController.vote);
  router.post(
    "/count/:id",
    bruteforce.prevent,
    auth,
    access(["MANAGER"]),
    statisticsController.countVotes
  );
  router.get(
    "/status/:id",
    bruteforce.prevent,
    auth,
    access(["MANAGER"]),
    statisticsController.showStatus
  );
  router.get(
    "/results/:id",
    bruteforce.prevent,
    auth,
    access(["MANAGER"]),
    statisticsController.showResults
  );
  router.get(
    "/results/user/:id",
    bruteforce.prevent,
    auth,
    statisticsController.showResultsUser
  );
  app.use("/vote", router);
};
