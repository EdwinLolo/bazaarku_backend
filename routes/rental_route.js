const express = require("express");
const router = express.Router();
// const controller = require("../controllers/index.js");
const {
  controller: rentalCategoryController,
  upload: uploadRentalCategoryImage,
} = require("../controllers/rental_controller");
const {
  controller: rentalProductsController,
  upload: uploadRentalProductImage,
} = require("../controllers/rental_products_controller");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// === RENTAL ROUTES WITH CHILDREN ===
router.get(
  "/rentals/with-products",
  rentalCategoryController.getAllRentalsWithProducts
);

// Get rental summary (statistics only)
router.get("/rentals/summary", rentalCategoryController.getRentalSummary);

// Get single rental with all products (paginated products)
router.get(
  "/rentals/:id/with-products",
  rentalCategoryController.getRentalWithAllProducts
);

// Rental Routes
router.get("/rentals", rentalCategoryController.getAllRentals);
router.get("/rentals/:id", rentalCategoryController.getRentalById);

// Protected routes (Admin only)
router.post(
  "/rentals",
  authenticate,
  requireAdmin,
  uploadRentalCategoryImage.single("banner_image"),
  rentalCategoryController.createRental
);
router.put(
  "/rentals/:id",
  authenticate,
  requireAdmin,
  uploadRentalCategoryImage.single("banner_image"),
  rentalCategoryController.updateRental
);
router.delete(
  "/rentals/:id",
  authenticate,
  requireAdmin,
  rentalCategoryController.deleteRental
);

// ---------------------------

// Rental Products Routes
router.get("/rental-products", rentalProductsController.getAllRentalProducts);
router.get(
  "/rental-products/:id",
  rentalProductsController.getRentalProductById
);

// Protected routes (Vendor or Admin)
router.post(
  "/rental-products",
  authenticate,
  requireAdmin,
  uploadRentalProductImage.single("product_image"), // 'product_image' is the field name for file uploadRentalProductImage
  rentalProductsController.createRentalProduct
);

router.put(
  "/rental-products/:id",
  authenticate,
  requireAdmin,
  uploadRentalProductImage.single("product_image"),
  rentalProductsController.updateRentalProduct
);
router.delete(
  "/rental-products/:id",
  authenticate,
  requireAdmin,
  rentalProductsController.deleteRentalProduct
);

module.exports = router;
