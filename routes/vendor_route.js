const express = require("express");
const router = express.Router();
const { controller, upload } = require("../controllers/vendor_controller");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// Public routes
router.get("/vendors", controller.getAllVendors);
router.get("/vendors/users", controller.getAllVendorsUser);
router.get("/vendors/statistics", controller.getVendorStatistics);
router.get("/vendors/:id", controller.getVendorById);

// Protected routes
// Get vendor by user ID (vendor can see their own, admin can see any)
router.get("/vendors/user/:user_id", controller.getVendorByUserId);

// Create vendor (admin or the user themselves if they have vendor role)
router.post(
  "/vendors",
  authenticate,
  requireAdmin,
  upload.single("banner_image"),
  controller.createVendor
);

// Update vendor (vendor can update their own, admin can update any)
router.put(
  "/vendors/:id",
  authenticate,
  requireVendorOrAdmin,
  upload.single("banner_image"),
  controller.updateVendor
);

// Delete vendor (admin only)
router.delete(
  "/vendors/:id",
  authenticate,
  requireAdmin,
  controller.deleteVendor
);

module.exports = router;
