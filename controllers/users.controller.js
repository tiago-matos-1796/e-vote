const db = require('../models');
const crypto = require('crypto');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');
const env = require('dotenv').config().parsed;

// DONE
async function register(req, res, next) {
    const regexExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi;
    const body = req.body;
    try {
        const hash = crypto.createHash('sha512');
        if(!regexExp.test(body.email)) {
            return next(createError(400, `Email ${body.email} is not in correct format`));
        }
        const username = body.email.split('@')[0];
        const userBody = {
            username: username,
            email: body.email,
            displayName: body.displayName,
            password: hash.update(body.password, 'utf-8').digest('hex'), // TBD in frontend
        }
        const user = await db.eVoteUser.create(userBody);
        return res.status(200).json(user);
    } catch (err) {
        throw err;
    }

}

// DONE
async function login(req, res, next) {
    const body = req.body;
    try {
        const hash = crypto.createHash('sha512');
        const user = await db.eVoteUser.findOne({where: {email: body.email, password:hash.update(body.password, 'utf-8').digest('hex')}});
        if(!user) {
            return next(createError(400, `Email and/or password is wrong`));
        } else {
            const token = jwt.sign({id: user.id, email: user.email, displayName: user.displayName, username: user.username}, env.JWT_SECRET, {expiresIn: "1h"});
            return res.status(200).json({id: user.id, email: user.email, displayName: user.displayName, username: user.username, token: token});
        }
    } catch (err) {
        throw err;
    }
}

async function update(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    try {

    } catch (err) {
        throw err;
    }
}

module.exports = {register, login, update}