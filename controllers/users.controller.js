const db = require('../models');
const crypto = require('crypto');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');
const config = process.env;
const uuid = require('uuid');

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
        const id = uuid.v1();
        const userBody = {
            id: id,
            username: username,
            email: body.email,
            displayName: body.displayName,
            password: hash.update(body.password, 'utf-8').digest('hex'), // TBD in frontend
            token: jwt.sign({id: id, username: username}, process.env.JWT_SECRET), // add expiration
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
            return res.status(200).json({id: user.id, email: user.email, displayName: user.displayName, username: user.username, permissions: user.permission, token: user.token});
        }
    } catch (err) {
        throw err;
    }
}

// DONE
async function update(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    const hash = crypto.createHash('sha512');
    try {
        const user = await db.eVoteUser.update({
            displayName: body.displayName,
            email: body.email,
            password: hash.update(body.password, 'utf-8').digest('hex'),
        },
            {
                where: {id: id},
            });
        return res.status(200).json(user);
    } catch (err) {
        throw err;
    }
}

// DONE
async function remove(req, res, next) {
    const id = req.params.id;
    try {
        const user = await db.eVoteUser.destroy({where: {id: id}});
        return res.status(200).json(user);
    } catch (err) {
        throw err;
    }
}

// DONE
async function changePermissions(req, res, next) {
    const id = req.params.id; // id of user in which permissions will be changed
    const permission = req.body.permission;
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    const transaction = await db.sequelize.transaction();
    const admin = await db.eVoteUser.findByPk(jwt.decode(token).id)
    if(admin.permission !== 'ADMIN') {
        return res.status(403).send("Not allowed");
    }
    try {
        const user = await db.eVoteUser.findByPk(id);
        const oldPermission = user.permission;
        await db.eVoteUser.update({permission: permission}, {where: {id: id}, transaction});
        await db.eVoteInternalLog.create({
            description: `${user.username}: permission changed from ${oldPermission} to ${permission}`,
            createdBy: admin.username,
        }, {transaction});
        await transaction.commit();
        return res.status(200).json({id: id, permission: permission});
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}


module.exports = {register, login, update, remove, changePermissions}