const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send("Authentication required");
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send("Invalid Token");
    }
  });
  return next();
}

module.exports = verifyToken;
