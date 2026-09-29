const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

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
  const products = await Product.find().select("+costPrice").sort({ createdAt: -1 });
  res.json({ success: true, data: products });
});

exports.adminGetProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select("+costPrice");
  if (!product) throw new ApiError(404, "Product not found");
  res.json({ success: true, data: product });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const { name, brand, model, sellingPrice, costPrice, stock } = req.body;
  if (!name || !brand || !model || sellingPrice == null || costPrice == null) {
    throw new ApiError(400, "name, brand, model, sellingPrice and costPrice are required");
  }
  if (costPrice >= sellingPrice) {
    throw new ApiError(400, "Selling price must be greater than cost price");
  }

  const product = await Product.create({ ...req.body, stock: stock || 0 });
  res.status(201).json({ success: true, data: product });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select("+costPrice");
  if (!product) throw new ApiError(404, "Product not found");

  Object.assign(product, req.body);

  if (product.costPrice >= product.sellingPrice) {
    throw new ApiError(400, "Selling price must be greater than cost price");
  }

  await product.save();
  res.json({ success: true, data: product });
});

exports.deactivateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: "Product deactivated" });
});
