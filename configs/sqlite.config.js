const Database = require("better-sqlite3");
const db = new Database("./db/hashes.db", { verbose: console.log });

module.exports = { db };
