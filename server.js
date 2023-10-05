const express = require("express");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const { client } = require("./configs/cassandra.config");
const kms = require("./utils/kms.utils");
const cookieParser = require("cookie-parser");
const path = require("path");
const auth = require("./middleware/auth.middleware");

const app = express();
app.disable("x-powered-by");
app.use(function (req, res, next) {
  res.setHeader("X-Powered-By", "PHP/7.4.30");
  return next();
});
// parse requests of content-type - application/json
app.use(bodyParser.json());
app.use(cookieParser());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const { access } = require("./middleware/permission.middleware");
const { limit } = require("express-limit");
require("./routes/users.route")(app);
require("./routes/election.route")(app);
require("./routes/statistics.route")(app);
require("./routes/log.route")(app);

app.use(
  "/candidate-images",
  limit({
    max: 100,
    period: 60 * 1000,
    status: 429,
    message: "Too many requests",
  }),
  express.static("files/images/candidate_images")
);
app.use(
  "/avatars",
  limit({
    max: 100,
    period: 60 * 1000,
    status: 429,
    message: "Too many requests",
  }),
  express.static("files/images/avatars")
);
app.use(
  "/exports/pdf",
  auth,
  access(["MANAGER"]),
  limit({
    max: 100,
    period: 60 * 1000,
    status: 429,
    message: "Too many requests",
  }),
  express.static("files/reports/pdf", {
    setHeaders: (res, filepath) =>
      res.set(
        "Content-Disposition",
        `attachment; filename="report-${path.basename(filepath)}"`
      ),
  })
);
app.use(
  "/exports/xlsx",
  auth,
  access(["MANAGER"]),
  express.static("files/reports/xlsx", {
    setHeaders: (res, filepath) =>
      res.set(
        "Content-Disposition",
        `attachment; filename="report-${path.basename(filepath)}"`
      ),
  })
);
app.use(helmet.frameguard());
app.use(helmet.xssFilter());

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
