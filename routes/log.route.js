const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const {access} = require('../middleware/permission.middleware');

module.exports = app => {
    const logController = require("../controllers/log.controller");
    router.get('/', auth, access(["AUDITOR"]), logController.show);
    app.use('/log', router);
}