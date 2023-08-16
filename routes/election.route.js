const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadCandidateImage } = require("../configs/multer.config");
const limit = require("express-limit").limit;

module.exports = (app) => {
  const electionController = require("../controllers/election.controller");
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
    access(["MANAGER"]),
    electionController.listByManager
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
  app.use("/elections", router);
};
