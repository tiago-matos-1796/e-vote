const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { client } = require("./configs/cassandra");
const kms = require("./utils/kms.utils");
const cookieParser = require("cookie-parser");

const app = express();

app.use(cors());

// parse requests of content-type - application/json
app.use(bodyParser.json());
app.use(cookieParser());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./models");
const { router } = require("express/lib/application");
require("./routes/users.route")(app);
require("./routes/election.route")(app);
require("./routes/statistics.route")(app);
require("./routes/log.route")(app);
// set port, listen for requests
async function kms_connection() {
  const c = await kms.kmsConnection();
  if (typeof c !== "undefined") {
    if (c.status === 200) {
      console.log(c.data);
    }
  }
}
kms_connection();
client.execute("SELECT NOW() FROM system.local;", function (err, result) {
  if (err) {
    console.log("Unable to connect Cassandra...");
  } else {
    console.log("Cassandra Database connected...");
  }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
