const jwt = require('jsonwebtoken');
const db = require('../models');
const access = (permissions) => {
    return async (req, res, next) => {
        const token = req.body.token || req.query.token || req.headers["x-api-key"];
        const id = jwt.decode(token).id;
        const user = await db.eVoteUser.findByPk(id);
        if(!permissions.includes(user.permission)) {
            return res.status(403).send("Invalid permissions");
        } else {
            return next();
        }
    };
};

module.exports = {access}