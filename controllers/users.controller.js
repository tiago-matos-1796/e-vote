const db = require('../models');

async function create(req, res, next) {
    return res.status(200).send("123");
}

async function update(req, res, next) {

}

module.exports = {create, update}