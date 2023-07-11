const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadCandidateImage } = require("../configs/multer");

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
  router.put("/:id", auth, access(["MANAGER"]), electionController.update);
  router.delete("/:id", auth, access(["MANAGER"]), electionController.remove);
  router.patch(
    "/:id",
    auth,
    access(["MANAGER"]),
    electionController.regenerateKeys
  );
  app.use("/elections", router);
};
