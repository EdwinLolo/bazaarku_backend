const express = require("express");
const router = express.Router();
const controller = require("../controllers/index.js");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

router.get("/areas", controller.area.getAllAreas);
router.get("/areas/dropdown", controller.area.getAreasDropdown);
router.get("/areas/with-count", controller.area.getAllAreasWithCount);
router.get("/areas/statistics", controller.area.getAreaStatistics);
router.get("/areas/:id", controller.area.getAreaById);
router.get("/areas/:id/with-count", controller.area.getAreaWithCount);

// Protected routes (Admin only)
router.post("/areas", controller.area.createArea);
router.put("/areas/:id", controller.area.updateArea);
router.delete("/areas/:id", controller.area.deleteArea);

// Bulk operations (Admin only)
router.post("/areas/bulk", controller.area.bulkCreateAreas);

module.exports = router;
