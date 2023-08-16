const multer = require("multer");

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/images/avatars");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const candidateStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/images/candidate_images");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fieldSize: 1048576 },
});

const uploadCandidateImage = multer({
  storage: candidateStorage,
  limits: { fieldSize: 2097152 },
});

module.exports = { uploadAvatar, uploadCandidateImage };
