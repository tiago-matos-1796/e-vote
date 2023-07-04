const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadAvatar } = require("../configs/multer");

module.exports = (app) => {
  const userController = require("../controllers/users.controller");
  router.get("/:id", auth, userController.show);
  router.post("/", uploadAvatar.single("image"), userController.register);
  router.post("/login", userController.login);
  router.put("/:id", auth, userController.update);
  router.delete("/:id", auth, userController.remove);
  router.patch(
    "/admin/:id",
    auth,
    access(["ADMIN"]),
    userController.changePermissions
  );
  router.get("/admin", auth, access(["ADMIN"]), userController.showUser);
  router.post("/key", auth, userController.regenerateKeys);
  router.get("/avatar", auth, userController.getAvatar);
  app.use("/users", router);
};
