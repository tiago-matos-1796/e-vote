const uuid = require("uuid");
const moment = require("moment");
const { client } = require("../configs/cassandra.config");

async function insertSystemLog(endpoint, log, method) {
  const insertionLog =
    "INSERT INTO system_log (id, endpoint, log, log_creation, method) VALUES (:id, :endpoint, :log, :log_creation, :method)";
  const logParams = {
    id: uuid.v1(),
    endpoint: endpoint,
    log: log,
    log_creation: moment().format("DD-MM-YYYY HH:mm"),
    method: method,
  };
  await client
    .execute(insertionLog, logParams, { prepare: true })
    .then(function (response) {
      return response;
    })
    .catch(function (error) {
      return error;
    });
}

async function insertInternalLog(log, type) {}

async function insertElectionLog(electionId, electionTitle, log, severity) {}

module.exports = {
  insertSystemLog,
  insertInternalLog,
  insertElectionLog,
};
