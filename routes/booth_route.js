const express = require("express");
const router = express.Router();
const controller = require("../controllers/index.js");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// Public routes
router.get("/booths/event/:event_id", controller.booth.getBoothsByEventId);

// Protected routes - Applicants can manage their applications
router.post("/booths", controller.booth.createBooth);
router.get("/booths/:id", controller.booth.getBoothById);
router.put("/booths/:id", controller.booth.updateBooth);
router.delete("/booths/:id", controller.booth.deleteBooth);

// Admin routes - Booth management and approval
router.get(
  "/booths",
  authenticate,
  requireAdmin,
  controller.booth.getAllBooths
);
router.get(
  "/booths/statistics",
  authenticate,
  requireAdmin,
  controller.booth.getBoothStatistics
);
router.put(
  "/booths/:id/status",
  authenticate,
  requireAdmin,
  controller.booth.updateBoothStatus
);
router.put(
  "/booths/bulk/status",
  authenticate,
  requireAdmin,
  controller.booth.bulkUpdateBoothStatus
);

module.exports = router;
