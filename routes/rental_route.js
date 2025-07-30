const express = require("express");
const router = express.Router();
const controller = require("../controllers/index.js");
const {
  controller: rentalProductsController,
  upload,
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
  controller.rental.getAllRentalsWithProducts
);

// Get rental summary (statistics only)
router.get("/rentals/summary", controller.rental.getRentalSummary);

// Get single rental with all products (paginated products)
router.get(
  "/rentals/:id/with-products",
  controller.rental.getRentalWithAllProducts
);

// Rental Routes
router.get("/rentals", controller.rental.getAllRentals);
router.get("/rentals/:id", controller.rental.getRentalById);

// Protected routes (Admin only)
router.post("/rentals", controller.rental.createRental);
router.put("/rentals/:id", controller.rental.updateRental);
router.delete("/rentals/:id", controller.rental.deleteRental);

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
  upload.single("product_image"), // 'product_image' is the field name for file upload
  rentalProductsController.createRentalProduct
);

router.put(
  "/rental-products/:id",
  upload.single("product_image"),
  rentalProductsController.updateRentalProduct
);
router.delete(
  "/rental-products/:id",
  rentalProductsController.deleteRentalProduct
);

module.exports = router;
