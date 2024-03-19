const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const bulkAuth = require("../middleware/bulk-auth.middleware");
const { access } = require("../middleware/permission.middleware");
const { uploadAvatar } = require("../configs/multer.config");
const { limit } = require("express-limit");
const cors = require("cors");
const helmet = require("helmet");

module.exports = (app) => {
  const userController = require("../controllers/users.controller");
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
        "register-token",
      ],
      credentials: true,
      maxAge: 31536000,
      preflightContinue: true,
      optionsSuccessStatus: 200,
    })
  );
  router.post(
    "/",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    uploadAvatar.single("image"),
    userController.register
  );
  router.post(
    "/bulk-register",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    bulkAuth,
    userController.bulkRegister
  );
  router.post(
    "/login",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    userController.login
  );
  router.post(
    "/forgot-password",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    userController.forgotPassword
  );
  router.post(
    "/admin/blacklist",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["ADMIN"]),
    userController.blacklistEmails
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
    uploadAvatar.single("image"),
    userController.update
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
    userController.remove
  );
  router.delete(
    "/admin/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["ADMIN"]),
    userController.adminUserDelete
  );
  router.patch(
    "/verify",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    userController.verify
  );
  router.patch(
    "/register",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    uploadAvatar.single("image"),
    userController.partialRegister
  );
  router.patch(
    "/password-recovery",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    userController.passwordRecovery
  );
  router.patch(
    "/admin/block/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["ADMIN"]),
    userController.blockUser
  );
  router.patch(
    "/admin/unblock/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["ADMIN"]),
    userController.unblockUser
  );
  router.patch(
    "/admin/:id",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["ADMIN"]),
    userController.changePermissions
  );
  router.get(
    "/user-list",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    access(["ADMIN", "MANAGER"]),
    userController.showUsers
  );
  router.get(
    "/profile",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    userController.show
  );
  router.post(
    "/key",
    limit({
      max: 100,
      period: 60 * 1000,
      status: 429,
      message: "Too many requests",
    }),
    auth,
    userController.regenerateKeys
  );
  app.use("/users", router);
};
