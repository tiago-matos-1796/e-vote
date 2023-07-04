const multer = require("multer");
const sharpMulter = require("sharp-multer");

const avatarStorage = sharpMulter({
  destination: function (req, file, cb) {
    cb(null, "files/images/avatars");
  },
  imageOptions: {
    fileFormat: "jpg",
    quality: 100,
    resize: { width: 180, height: 180 },
    useTimestamp: true,
  },
});

const candidateStorage = sharpMulter({
  destination: function (req, file, cb) {
    cb(null, "files/images/candidate_images");
  },
  imageOptions: {
    fileFormat: "jpg",
    quality: 100,
    resize: { width: 300, height: 300 },
    useTimestamp: true,
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fieldSize: 1048576 },
});
const uploadCandidateImage = multer({ storage: candidateStorage });

module.exports = { uploadAvatar, uploadCandidateImage };
