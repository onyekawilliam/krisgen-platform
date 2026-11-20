const cloudinary = require("cloudinary").v2;
const ApiError = require("../utils/ApiError");

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new ApiError(503, "Product photo and video uploads are not configured on the server.");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function upload(buffer, resourceType) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "krisgen/products", resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve({ secureUrl: result?.secure_url, publicId: result?.public_id });
      }
    ).end(buffer);
  });
}

function destroy(publicId, resourceType) {
  configureCloudinary();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}

const uploadProductImage = (buffer) => upload(buffer, "image");
const deleteProductImage = (publicId) => destroy(publicId, "image");
const uploadProductVideo = (buffer) => upload(buffer, "video");
const deleteProductVideo = (publicId) => destroy(publicId, "video");

module.exports = { uploadProductImage, deleteProductImage, uploadProductVideo, deleteProductVideo };
