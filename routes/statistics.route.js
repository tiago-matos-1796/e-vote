const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const {access} = require("../middleware/permission.middleware");

module.exports = app => {
    const statisticsController = require("../controllers/statistics.controller");
    router.post('/:id', auth, statisticsController.vote);
    router.get('/:id', auth, access(["MANAGER"]), statisticsController.showResults);
    app.use('/vote', router);
}