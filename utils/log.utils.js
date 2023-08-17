const uuid = require("uuid");
const moment = require("moment");
const { client } = require("../configs/cassandra.config");

async function insertSystemLog(endpoint, log, stack, method) {
  const insertionLog =
    "INSERT INTO system_log (id, endpoint, log, log_creation, method, stack) VALUES (:id, :endpoint, :log, :log_creation, :method, :stack)";
  const logParams = {
    id: uuid.v1(),
    endpoint: endpoint,
    log: log,
    log_creation: moment().format("DD-MM-YYYY HH:mm"),
    method: method,
    stack: stack,
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

async function insertInternalLog(log) {
  const insertionLog =
    "INSERT INTO internal_log (id, log_creation, log, type) VALUES (:id, :log_creation, :log, :type)";
  const logParams = {
    id: uuid.v1(),
    log_creation: moment().format("DD-MM-YYYY HH:mm"),
    log: log,
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

async function insertElectionLog(electionId, electionTitle, log, severity) {
  const insertionLog =
    "INSERT INTO election_log (id, log_creation, election_id, election_title, log, severity) VALUES (:id, :log_creation, :election_id, :election_title, :log, :severity)";
  const logParams = {
    id: uuid.v1(),
    log_creation: moment().format("DD-MM-YYYY HH:mm"),
    election_id: electionId,
    election_title: electionTitle,
    log: log,
    severity: severity,
  };
  await client.execute(insertionLog, logParams, { prepare: true });
}

module.exports = {
  insertSystemLog,
  insertInternalLog,
  insertElectionLog,
};
