const {client}  = require('../configs/cassandra');
async function show(req, res, next) {
    try {
        const ELquery = 'SELECT * FROM election_log ALLOW FILTERING';
        const electionLogs = await client.execute(ELquery);
        const ILquery = 'SELECT * FROM internal_log ALLOW FILTERING';
        const internalLogs = await client.execute(ILquery);
        return res.status(200).json({election_logs: electionLogs.rows, internal_logs: internalLogs.rows});
    } catch (err) {
        throw err;
    }
}

module.exports = {show};