const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');

module.exports = app => {
    const statisticsController = require("../controllers/statistics.controller");
    router.post('/', auth, statisticsController.vote);
    router.get('/', auth, statisticsController.showResults);
    app.use('/vote', router);
}