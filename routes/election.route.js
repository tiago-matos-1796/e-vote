const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadCandidateImage } = require("../configs/multer.config");
const electionController = require("../controllers/election.controller");

module.exports = (app) => {
  const electionController = require("../controllers/election.controller");
  router.get("/voter", auth, electionController.listByVoter);
  router.get(
    "/manager",
    auth,
    access(["MANAGER"]),
    electionController.listByManager
  );
  router.get("/:id", auth, electionController.showBallot);
  router.get(
    "/manager/:id",
    auth,
    access(["MANAGER"]),
    electionController.managerShow
  );
  router.post(
    "/",
    auth,
    access(["MANAGER"]),
    uploadCandidateImage.array("images"),
    electionController.create
  );
  router.post("/signature", auth, electionController.createSignature);
  router.put(
    "/:id",
    auth,
    access(["MANAGER"]),
    uploadCandidateImage.array("images"),
    electionController.update
  );
  router.delete("/:id", auth, access(["MANAGER"]), electionController.remove);
  router.patch(
    "/:id",
    auth,
    access(["MANAGER"]),
    electionController.regenerateKeys
  );
  app.use("/elections", router);
};
