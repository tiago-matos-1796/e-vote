const cassandra = require("cassandra-driver");
const env = process.env;
const options = {
  contactPoints: ["127.0.0.1"],
  protocolOptions: {
    port: 9042,
  },
  localDataCenter: "datacenter1",
  credentials: {
    username: process.env.CASSANDRA_USER,
    password: process.env.CASSANDRA_PASS,
  },
  keyspace: "e_vote",
};

const client = new cassandra.Client(options);

module.exports = { client };
