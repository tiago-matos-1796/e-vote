const express = require("express");
const router = express.Router();
const userRoutes = require("./users.route");
const electionRoutes = require("./election.route");
const voteRoutes = require("./statistics.route");
const logRoutes = require("./log.route");

router.use("/users", userRoutes);
router.use("/elections", electionRoutes);
router.use("/vote", voteRoutes);
router.use("/log", logRoutes);
module.exports = router;
