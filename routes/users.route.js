const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const bulkAuth = require("../middleware/bulk-auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadAvatar } = require("../configs/multer.config");
const { bruteforce } = require("../middleware/brute-force.middleware");

module.exports = (app) => {
  const userController = require("../controllers/users.controller");
  router.post(
    "/",
    bruteforce.prevent,
    uploadAvatar.single("image"),
    userController.register
  );
  router.post(
    "/bulk-register",
    bruteforce.prevent,
    bulkAuth,
    userController.bulkRegister
  );
  router.post("/login", bruteforce.prevent, userController.login);
  router.post(
    "/forgot-password",
    bruteforce.prevent,
    userController.forgotPassword
  );
  router.post(
    "/admin/blacklist",
    bruteforce.prevent,
    auth,
    access(["ADMIN"]),
    userController.blacklistEmails
  );
  router.put(
    "/:id",
    bruteforce.prevent,
    auth,
    uploadAvatar.single("image"),
    userController.update
  );
  router.delete("/:id", bruteforce.prevent, auth, userController.remove);
  router.delete(
    "/admin/:id",
    bruteforce.prevent,
    auth,
    access(["ADMIN"]),
    userController.adminUserDelete
  );
  router.patch(
    "/register/:token",
    bruteforce.prevent,
    uploadAvatar.single("image"),
    userController.partialRegister
  );
  router.patch("/verify/:token", bruteforce.prevent, userController.verify);
  router.patch(
    "/password-recovery/:token",
    bruteforce.prevent,
    userController.passwordRecovery
  );
  router.patch(
    "/admin/block/:id",
    bruteforce.prevent,
    auth,
    access(["ADMIN"]),
    userController.blockUser
  );
  router.patch(
    "/admin/unblock/:id",
    bruteforce.prevent,
    auth,
    access(["ADMIN"]),
    userController.unblockUser
  );
  router.patch(
    "/admin/:id",
    bruteforce.prevent,
    auth,
    access(["ADMIN"]),
    userController.changePermissions
  );
  router.get(
    "/user-list",
    bruteforce.prevent,
    auth,
    access(["ADMIN", "MANAGER"]),
    userController.showUsers
  );
  router.get("/profile", bruteforce.prevent, auth, userController.show);
  router.post("/key", bruteforce.prevent, auth, userController.regenerateKeys);
  app.use("/users", router);
};
