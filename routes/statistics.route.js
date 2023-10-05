const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { limit } = require("express-limit");
const cors = require("cors");
const helmet = require("helmet");

module.exports = (app) => {
  const statisticsController = require("../controllers/statistics.controller");
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: "same-site",
      },
    })
  );
  app.use(
    cors({
      origin: process.env.FRONTEND_URI,
      methods: ["GET", "PUT", "PATCH", "POST", "DELETE"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "SESSION-TOKEN",
      ],
      credentials: true,
      maxAge: 31536000,
      preflightContinue: true,
      optionsSuccessStatus: 200,
    })
  );
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
    access(["MANAGER", "AUDITOR"]),
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
    access(["MANAGER", "AUDITOR"]),
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
