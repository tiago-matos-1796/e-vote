const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadAvatar } = require("../configs/multer.config");
const userController = require("../controllers/users.controller");

module.exports = (app) => {
  const userController = require("../controllers/users.controller");
  router.post("/", uploadAvatar.single("image"), userController.register);
  router.post("/login", userController.login);
  router.put("/:id", auth, uploadAvatar.single("image"), userController.update);
  router.delete("/:id", auth, userController.remove);
  router.delete(
    "/admin/:id",
    auth,
    access(["ADMIN"]),
    userController.adminUserDelete
  );
  router.patch(
    "/admin/block/:id",
    auth,
    access(["ADMIN"]),
    userController.blockUser
  );
  router.patch(
    "/admin/unblock/:id",
    auth,
    access(["ADMIN"]),
    userController.unblockUser
  );
  router.patch(
    "/admin/:id",
    auth,
    access(["ADMIN"]),
    userController.changePermissions
  );
  router.get(
    "/user-list",
    auth,
    access(["ADMIN", "MANAGER"]),
    userController.showUsers
  );
  router.get("/profile", auth, userController.show);
  router.post("/key", auth, userController.regenerateKeys);
  app.use("/users", router);
};
