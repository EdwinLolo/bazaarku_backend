const express = require("express");
const router = express.Router();
const { controller, upload } = require("../controllers/banner_controller");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// Public routes
router.get("/banners/active", controller.getActiveBanners);
router.get("/banners", controller.getAllBanners);
router.get("/banners/:id", controller.getBannerById);

// Protected routes (Admin only)
router.post(
  "/banners",
  authenticate,
  requireAdmin,
  upload.single("banner_image"), // 'banner_image' is the field name for file upload
  controller.createBanner
);

router.put(
  "/banners/:id",
  authenticate,
  requireAdmin,
  upload.single("banner_image"),
  controller.updateBanner
);

router.delete(
  "/banners/:id",
  authenticate,
  requireAdmin,
  controller.deleteBanner
);

module.exports = router;
