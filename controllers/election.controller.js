const db = require('../models');
const crypto = require('crypto');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');
const config = process.env;
const uuid = require('uuid');
const {sequelize} = require('../models/index');
const encryption = require('../services/encryption.service');

async function list(req, res, next) {}

async function show(req, res, next) {}
async function create(req, res, next) {
    const body = req.body;
    try {
        const keyPair = encryption.generateKeys(body.key);
        const electionId = uuid.v1();
        await sequelize.query('CALL ')
    } catch (err) {
        throw err;
    }
}

async function update(req, res, next) {}

async function remove(req, res, next) {}

async function vote(req, res, next) {}

async function showResults(req, res, next) {}

module.exports = {list, show, create, update, remove, vote, showResults}