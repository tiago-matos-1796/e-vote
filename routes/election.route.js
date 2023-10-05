const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadCandidateImage } = require("../configs/multer.config");
const cors = require("cors");
const helmet = require("helmet");
const limit = require("express-limit").limit;

module.exports = (app) => {
  const electionController = require("../controllers/election.controller");
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
  router.get(
    "/voter",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    electionController.listByVoter
  );
  router.get(
    "/manager",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER", "AUDITOR"]),
    electionController.listByManager
  );
  router.get(
    "/fraud",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["AUDITOR"]),
    electionController.showFrauds
  );
  router.get(
    "/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    electionController.showBallot
  );
  router.get(
    "/manager/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    electionController.managerShow
  );
  router.post(
    "/",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    uploadCandidateImage.array("images"),
    electionController.create
  );
  router.post(
    "/signature",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    electionController.createSignature
  );
  router.put(
    "/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    uploadCandidateImage.array("images"),
    electionController.update
  );
  router.delete(
    "/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    electionController.remove
  );
  router.patch(
    "/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["MANAGER"]),
    electionController.regenerateKeys
  );
  router.patch(
    "/fraud/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["AUDITOR"]),
    electionController.removeFraud
  );
  app.use("/elections", router);
};
