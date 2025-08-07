const express = require("express");
const router = express.Router();
const controller = require("../controllers/index.js");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

router.get("/event-categories", controller.eventCategory.getAllEventCategories);
router.get(
  "/event-categories/with-count",
  controller.eventCategory.getAllCategoriesWithCount
);
router.get(
  "/event-categories/:id",
  controller.eventCategory.getEventCategoryById
);
router.get(
  "/event-categories/:id/with-count",
  controller.eventCategory.getEventCategoryWithCount
);

// Protected routes (Admin only)
router.post(
  "/event-categories",
  authenticate,
  requireAdmin,
  controller.eventCategory.createEventCategory
);
router.put(
  "/event-categories/:id",
  authenticate,
  requireAdmin,
  controller.eventCategory.updateEventCategory
);
router.delete(
  "/event-categories/:id",
  authenticate,
  requireAdmin,
  controller.eventCategory.deleteEventCategory
);

// Bulk operations (Admin only)
router.post(
  "/event-categories/bulk",
  authenticate,
  requireAdmin,
  controller.eventCategory.bulkCreateEventCategories
);

module.exports = router;
