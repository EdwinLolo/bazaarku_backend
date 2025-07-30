const express = require("express");
const router = express.Router();
const { controller, upload } = require("../controllers/event_controller");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// Public routes
router.get("/events", controller.getAllEvents);
router.get("/events/statistics", controller.getEventStatistics);
router.get("/events/:id", controller.getEventById);

// Vendor routes
router.get("/events/vendor/:vendor_id", controller.getEventsByVendorId);

// Protected routes
router.post(
  "/events",
  upload.fields([
    { name: "banner_image", maxCount: 1 },
    { name: "permit_img", maxCount: 1 },
  ]),
  controller.createEvent
);

router.put(
  "/events/:id",
  upload.fields([
    { name: "banner_image", maxCount: 1 },
    { name: "permit_img", maxCount: 1 },
  ]),
  controller.updateEvent
);

router.delete("/events/:id", controller.deleteEvent);

module.exports = router;
