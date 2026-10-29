const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { validStock, validRate } = require("../utils/numericIntegrity");
const cloudinaryImages = require("../services/cloudinaryImageService");

const productFields = new Set(["name", "brand", "model", "images", "ram", "storage", "colors",
  "specifications", "description", "costPrice", "sellingPrice", "stock", "isActive", "commissionRateOverride"]);
function validateProductChanges(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !productFields.has(key))) {
    throw new ApiError(400, "Only editable product fields may be submitted");
  }
  if (Object.hasOwn(body, "stock") && !validStock(body.stock)) {
    throw new ApiError(400, "Stock must be a non-negative safe whole number");
  }
  if (Object.hasOwn(body, "commissionRateOverride") && body.commissionRateOverride !== null && !validRate(body.commissionRateOverride)) {
    throw new ApiError(400, "Commission percentage must be between 0 and 100, or null to use the default");
  }
}

// Public/customer listing — costPrice is excluded at the query level
// (schema has select:false on it), so it never even reaches this handler
// unless explicitly requested with admin-only logic below.
exports.listProducts = asyncHandler(async (req, res) => {
  const { brand, minPrice, maxPrice, search, page = 1, limit = 20 } = req.query;

  const query = { isActive: true };
  if (brand && brand !== "All") query.brand = brand;
  if (minPrice || maxPrice) {
    query.sellingPrice = {};
    if (minPrice) query.sellingPrice.$gte = Number(minPrice);
    if (maxPrice) query.sellingPrice.$lte = Number(maxPrice);
  }
  if (search) query.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    Product.countDocuments(query),
  ]);

  res.json({ success: true, data: products, meta: { total, page: Number(page), limit: Number(limit) } });
});

exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true });
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ success: true, data: product });
});

// ----- Admin only below -----

exports.adminListProducts = asyncHandler(async (req, res) => {
  const products = await Product.find().select("+costPrice +imagePublicId").sort({ createdAt: -1 });
  res.json({ success: true, data: products });
});

exports.adminGetProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select("+costPrice +imagePublicId");
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ success: true, data: product });
});

exports.createProduct = asyncHandler(async (req, res) => {
  validateProductChanges(req.body);
  const { name, brand, model, sellingPrice, costPrice, stock } = req.body;
  if (!name || !brand || !model || sellingPrice == null || costPrice == null) {
    throw new ApiError(400, "name, brand, model, sellingPrice and costPrice are required");
  }
  if (costPrice >= sellingPrice) {
    throw new ApiError(400, "Selling price must be greater than cost price");
  }

  const product = await Product.create({ ...req.body, stock: stock === undefined ? 0 : stock });
  res.status(201).json({ success: true, data: product });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  validateProductChanges(req.body);
  const product = await Product.findById(req.params.id).select("+costPrice +imagePublicId");
  if (!product) throw new ApiError(404, "Product not found");

  const previousPublicId = product.imagePublicId;
  const previousImageUrl = product.images?.[0];
  Object.assign(product, req.body);
  if (Object.hasOwn(req.body, "images")) product.imagePublicId = undefined;

  if (product.costPrice >= product.sellingPrice) {
    throw new ApiError(400, "Selling price must be greater than cost price");
  }

  await product.save();
  let cleanupWarning = null;
  if (Object.hasOwn(req.body, "images") && previousPublicId) {
    cleanupWarning = await deleteCloudinaryImageIfUnused(previousPublicId, previousImageUrl);
  }
  res.json({ success: true, data: product, ...(cleanupWarning ? { warning: cleanupWarning } : {}) });
});

exports.deactivateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: "Product deactivated" });
});

function validateProductImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ApiError(400, "Choose an image file to upload");
  }
  if (file.size > 5 * 1024 * 1024 || file.buffer.length > 5 * 1024 * 1024) {
    throw new ApiError(413, "Product images must be 5 MB or smaller");
  }

  const bytes = file.buffer;
  const detected = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? "image/jpeg"
      : bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))
        ? "image/gif"
        : bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
          ? "image/webp"
          : bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp" &&
              ["avif", "avis"].includes(bytes.subarray(8, 12).toString("ascii"))
            ? "image/avif"
            : null;

  if (!detected || file.mimetype !== detected) {
    throw new ApiError(400, "Upload a valid JPEG, PNG, WebP, GIF, or AVIF image");
  }
}

async function storeProductImage(file) {
  validateProductImage(file);
  let asset;
  try {
    asset = await cloudinaryImages.uploadProductImage(file.buffer);
  } catch (error) {
    if (error.statusCode) throw error;
    throw new ApiError(502, "Cloudinary could not store the product image. Please try again.");
  }
  if (typeof asset?.secureUrl !== "string" || !asset.secureUrl.startsWith("https://") ||
      typeof asset?.publicId !== "string" || !asset.publicId) {
    throw new ApiError(502, "Cloudinary returned incomplete image details. Please try again.");
  }
  return asset;
}

async function deleteCloudinaryImageIfUnused(publicId, imageUrl) {
  if (!publicId) return null;
  try {
    const references = [{ imagePublicId: publicId }];
    if (imageUrl) references.push({ images: imageUrl });
    if (await Product.exists({ $or: references })) return null;
    await cloudinaryImages.deleteProductImage(publicId);
    return null;
  } catch {
    return "The product image changed, but its unused Cloudinary copy could not be removed.";
  }
}

async function removeNewAssetAfterFailure(publicId, imageUrl) {
  if (!publicId) return;
  try {
    const references = [{ imagePublicId: publicId }];
    if (imageUrl) references.push({ images: imageUrl });
    if (!(await Product.exists({ $or: references }))) {
      await cloudinaryImages.deleteProductImage(publicId);
    }
  } catch {
    // Preserve the original product-save error; cleanup is best-effort.
  }
}

function setPrimaryImage(product, asset) {
  const images = Array.isArray(product.images) ? [...product.images] : [];
  if (images.length) images[0] = asset.secureUrl;
  else images.push(asset.secureUrl);
  product.images = images;
  product.imagePublicId = asset.publicId;
}

exports.uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Choose an image file to upload");
  const product = await Product.findById(req.params.id).select("+imagePublicId");
  if (!product) throw new ApiError(404, "Product not found");

  const asset = await storeProductImage(req.file);
  const previousPublicId = product.imagePublicId;
  const previousImageUrl = product.images?.[0];
  setPrimaryImage(product, asset);
  try {
    await product.save();
  } catch (error) {
    await removeNewAssetAfterFailure(asset.publicId, asset.secureUrl);
    throw error;
  }

  const cleanupWarning = previousPublicId && previousPublicId !== asset.publicId
    ? await deleteCloudinaryImageIfUnused(previousPublicId, previousImageUrl)
    : null;
  res.json({ success: true, data: product, ...(cleanupWarning ? { warning: cleanupWarning } : {}) });
});

exports.deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select("+imagePublicId");
  if (!product) throw new ApiError(404, "Product not found");

  const previousPublicId = product.imagePublicId;
  const previousImageUrl = product.images?.[0];
  const images = Array.isArray(product.images) ? [...product.images] : [];
  images.shift();
  product.images = images;
  product.imagePublicId = undefined;
  await product.save();

  const cleanupWarning = await deleteCloudinaryImageIfUnused(previousPublicId, previousImageUrl);
  res.json({ success: true, data: product, ...(cleanupWarning ? { warning: cleanupWarning } : {}) });
});
