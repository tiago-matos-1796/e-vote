const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { limit } = require("express-limit");
const cors = require("cors");
const helmet = require("helmet");

module.exports = (app) => {
  const logController = require("../controllers/log.controller");
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
      allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"],
      credentials: true,
      maxAge: 31536000,
      preflightContinue: true,
      optionsSuccessStatus: 200,
    })
  );
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
