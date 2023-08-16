const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { limit } = require("express-limit");

module.exports = (app) => {
  const statisticsController = require("../controllers/statistics.controller");
  router.post(
    "/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    statisticsController.vote
  );
  router.post(
    "/count/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    statisticsController.countVotes
  );
  router.get(
    "/status/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    statisticsController.showStatus
  );
  router.get(
    "/results/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    statisticsController.showResults
  );
  router.get(
    "/results/user/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    statisticsController.showResultsUser
  );
  app.use("/vote", router);
};
