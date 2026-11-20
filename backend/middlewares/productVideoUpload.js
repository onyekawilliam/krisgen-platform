const multer = require("multer");
const ApiError = require("../utils/ApiError");

const MAX_VIDEO_MB = 50;
// MP4 (most phones and downloads), MOV (iPhones) and WebM.
const allowedMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(400, "Upload an MP4, MOV or WebM video"));
    }
    callback(null, true);
  },
});

function productVideoUpload(req, res, next) {
  upload.single("video")(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, `Product videos must be ${MAX_VIDEO_MB} MB or smaller`));
    }
    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, "Upload one product video at a time"));
    }
    next(error);
  });
}

module.exports = productVideoUpload;
module.exports.MAX_VIDEO_MB = MAX_VIDEO_MB;
