const cronjob = require("node-cron");
const moment = require("moment");
const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const { client } = require("../configs/cassandra.config");
const { createHash } = require("crypto");
const logger = require("../utils/log.utils");
const hashes = require("../configs/sqlite.config").db;

function ballotIntegrity() {
  const job = cronjob.schedule("* * * * *", async () => {
    const now = moment().format("DD-MM-YYYY HH:mm");
    const terminatedElections = await sequelize.query(
      "select * from e_vote_election where end_date = :now",
      {
        type: QueryTypes.SELECT,
        replacements: { now: now },
      }
    );
    if (terminatedElections.length > 0) {
      for (const election of terminatedElections) {
        const query =
          "SELECT vote FROM votes WHERE election_id = :id ALLOW FILTERING";
        const params = { id: election.id };
        const votes = await client.execute(query, params, { prepare: true });
        const hash = createHash("sha256")
          .update(JSON.stringify(votes.rows))
          .digest("base64");
        const lastStatus = hashes
          .prepare("SELECT * FROM status WHERE id = ?")
          .get(election.id);
        if (lastStatus.hash !== hash) {
          await logger.insertElectionLog(
            election.id,
            election.title,
            `Ballot box has been tampered; Last status ${stmt.hash} does not match ballot box status after election ${hash}`,
            "HIGH"
          );
          await sequelize.query("CALL insert_fraud (:election);", {
            replacements: { election: election.id },
          });
        }
        const integrityStmt = hashes.prepare(
          "INSERT INTO integrity(id, hash) VALUES (?, ?)"
        );
        integrityStmt.run(election.id, hash);
      }
    }
  });
  job.start();
}

module.exports = { ballotIntegrity };
