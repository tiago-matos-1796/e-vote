const kms = require('../utils/kms.utils');
const crypto = require('crypto');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');
const config = require('dotenv').config().parsed;
const uuid = require('uuid');
const {sequelize} = require('../models/index');
const {QueryTypes} = require('sequelize');
const emailValidator = require('email-validator');
const uuidValidator = require('uuid-validate');
const email_regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi;
const permissions = ['ADMIN', 'MANAGER', 'AUDITOR', 'REGULAR'];
const encryption = require('../services/encryption.service');

// DONE
async function register(req, res, next) {
    const body = req.body;
    try {
        const hash = crypto.createHash('sha512');
        if(!emailValidator.validate(body.email)) {
            return next(createError(400, `Email ${body.email} is not in correct format`));
        }
        const result = await sequelize.query('SELECT * from e_vote_user WHERE email=:email;', {
            type: QueryTypes.SELECT,
            replacements: {email: body.email}
        });
        if(result.length > 0) {
            return next(createError(400, `Email ${body.email} already in use`));
        }
        if(body.password.length !== 16) {
            return next(createError(400, `Password must have a length of 16`));
        }
        const keys = encryption.generateKeys(body.password);
        const username = body.email.split('@')[0];
        const image = body.image.length > 0 ? body.image : null;
        const password = hash.update(body.password, 'utf-8').digest('hex');
        const id = uuid.v1();
        const token = jwt.sign({id: id, username: username}, config.JWT_SECRET);
        await sequelize.query('CALL insert_user (:id, :username, :email, :display_name, :image, :password, :permission, :token);', {
            replacements: {id: id, username: username, email: body.email, display_name: body.display_name, image: image, password: password, permission: 'REGULAR', token: token}
        });
        const key = await kms.insertSignature(id, keys.publicKey, keys.privateKey, keys.iv);
        if(key.status !== 201) {
            if(key.status === 400) {
                return next(createError(400, `Duplicate key`));
            }else {
                return res.status(500).send("Error inserting user keys");
            }
        }
        return res.status(200).json({id: id, username: username, email: body.email, display_name: body.display_name, image: image, permission: 'REGULAR', token: token});
    } catch (err) {
        throw err;
    }

}

// DONE
async function login(req, res, next) {
    const body = req.body;
    try {
        if(!emailValidator.validate(body.email)) {
            return next(createError(400, `Email ${body.email} is not in correct format`));
        }
        const hash = crypto.createHash('sha512');
        const password = hash.update(body.password, 'utf-8').digest('hex');
        let user = await sequelize.query('SELECT * from e_vote_user WHERE email = :email AND password = :password', {
            type: QueryTypes.SELECT,
            replacements: {email: body.email, password: password}
        });
        if(user.length === 0) {
            return next(createError(400, `Email and/or password is wrong`));
        }
        user = user[0];
        return res.status(200).json({id: user.id, email: user.email, displayName: user.displayName, username: user.username, permissions: user.permission, token: user.token});
    } catch (err) {
        throw err;
    }
}

// DONE
async function update(req, res, next) {
    const id = req.params.id;
    const body = req.body;
    try {
        if(!uuidValidator(id, 1)) {
            return next(createError(400, `id ${id} cannot be validated`));
        }
        if(!emailValidator.validate(body.email)) {
            return next(createError(400, `Email ${body.email} is not in correct format`));
        }
        const user = await sequelize.query('SELECT * from e_vote_user WHERE id = :id', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        if(user.length === 0) {
            return next(createError(404, `User ${id} not found`));
        }
        const userEmail = await sequelize.query('SELECT * from e_vote_user WHERE email = :email AND NOT id = :id', {
            type: QueryTypes.SELECT,
            replacements: {email: body.email, id: id}
        });
        if(userEmail.length > 0) {
            return next(createError(400, `Email ${body.email} already in user`));
        }
        const hash = crypto.createHash('sha512');
        const password = body.password.length > 0 ? hash.update(body.password, 'utf-8').digest('hex') : user[0].password;
        await sequelize.query('CALL update_user (:id, :email, :display_name, :password);', {
            replacements: {id: id, email: body.email, display_name: body.display_name, password: password}
        });
        return res.status(200).json({id: id, email: body.email, display_name: body.display_name});
    } catch (err) {
        throw err;
    }
}

// TODO check if user belongs to an active election, do not delete if its the case
async function remove(req, res, next) {
    const id = req.params.id;
    try {
        if(!uuidValidator(id, 1)) {
            return next(createError(400, `id ${id} cannot be validated`));
        }
        const user = await sequelize.query('SELECT * from e_vote_user WHERE id = :id', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        if(user.length === 0) {
            return next(createError(404, `User ${id} not found`));
        }
        await sequelize.query('CALL delete_user (:id);', {
            replacements: {id: id}
        });
        return res.status(200).json(1);
    } catch (err) {
        throw err;
    }
}

// DONE
async function changePermissions(req, res, next) {
    const id = req.params.id; // id of user in which permissions will be changed
    const permission = req.body.permission;
    if(!uuidValidator(id, 1)) {
        return next(createError(400, `id ${id} cannot be validated`));
    }
    if(!permissions.includes(permission)) {
        return next(createError(400, `Permission ${permission} is not a valid permission`));
    }
    const token = req.body.token || req.query.token || req.headers["x-api-key"];
    try {
        const admin = await sequelize.query('SELECT id, username, permission FROM e_vote_user WHERE id = :id', {
            type: QueryTypes.SELECT,
            replacements: {id: jwt.decode(token).id}
        });
        const user = await sequelize.query('SELECT id, username, permission FROM e_vote_user WHERE id = :id', {
            type: QueryTypes.SELECT,
            replacements: {id: id}
        });
        if(user.length === 0) {
            return next(createError(404, `User ${id} not found`));
        }
        const oldPermission = user[0].permission;
        await sequelize.query('CALL change_user_permission(:id, :permission);', {
            replacements: {id: id, permission: permission}
        });
        await sequelize.query('CALL insert_internal_log(:description, :author);', {
            replacements: {description: `${admin[0].username} changed permission of ${user[0].username} from ${oldPermission} to ${permission}`, author: admin[0].username}
        });
        return res.status(200).json({id: id, permission: permission});
    } catch (err) {
        throw err;
    }
}


module.exports = {register, login, update, remove, changePermissions}