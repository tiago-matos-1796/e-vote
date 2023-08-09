const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { client } = require("./configs/cassandra.config");
const kms = require("./utils/kms.utils");
const cookieParser = require("cookie-parser");
const path = require("path");
const auth = require("./middleware/auth.middleware");
const permission = require("./middleware/permission.middleware");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: true,
    optionsSuccessStatus: 200,
  })
);
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URI); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
// parse requests of content-type - application/json
app.use(bodyParser.json());
app.use(cookieParser());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./models");
const { router } = require("express/lib/application");
const { access } = require("./middleware/permission.middleware");
require("./routes/users.route")(app);
require("./routes/election.route")(app);
require("./routes/statistics.route")(app);
require("./routes/log.route")(app);

app.use("/candidate-images", express.static("files/images/candidate_images"));
app.use("/avatars", express.static("files/images/avatars"));
app.use("/api-images", express.static("files/images/api_images"));
app.use(
  "/exports/pdf",
  auth,
  access(["MANAGER"]),
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

app.disable("x-powered-by");

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
