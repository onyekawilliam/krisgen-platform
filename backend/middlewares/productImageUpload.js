const multer = require("multer");
const ApiError = require("../utils/ApiError");

const allowedMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(400, "Upload a valid JPEG, PNG, WebP, GIF, or AVIF image"));
    }
    callback(null, true);
  },
});

module.exports = function productImageUpload(req, res, next) {
  upload.single("image")(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, "Product images must be 5 MB or smaller"));
    }
    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, "Upload one product image at a time"));
    }
    next(error);
  });
};
