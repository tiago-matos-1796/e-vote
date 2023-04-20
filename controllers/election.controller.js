const db = require('../models');
const crypto = require('crypto');
const createError = require('http-errors');
const jwt = require('jsonwebtoken');
const config = process.env;
const uuid = require('uuid');
const encryption = require('../services/encryption.service');

async function list(req, res, next) {}

async function show(req, res, next) {}
async function create(req, res, next) {
    const body = req.body;
    try {
        const keyPair = encryption.generateKeys(body.key);
        const user = await db.eVoteElection.create({
            title: body.title,
            startDate: body.startDate,
            endDate: body.endDate,
            key: keyPair.publicKey,
        })
    } catch (err) {
        throw err;
    }
}

async function update(req, res, next) {}

async function remove(req, res, next) {}

async function vote(req, res, next) {}

async function showResults(req, res, next) {}

module.exports = {list, show, create, update, remove, vote, showResults}