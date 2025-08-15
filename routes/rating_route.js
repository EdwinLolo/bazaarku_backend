const express = require("express");
const router = express.Router();
const ratingController = require("../controllers/rating_controller.js");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// Public routes (anyone can view ratings)
router.get("/rating", ratingController.getRatings);
router.get("/rating/:id", ratingController.getRatingById);
router.get("/rating/event/:event_id", ratingController.getRatingsByEventId);
router.get("/rating/:event_id/stats", ratingController.getEventRatingStats);

// Protected routes (authenticated users can create ratings)
router.post("/rating", ratingController.createRating);

// Admin/Vendor routes (can update/delete ratings)
router.put("/rating/:id", ratingController.updateRating);
router.delete("/rating/:id", ratingController.deleteRating);

// Admin only routes
router.delete("/rating/:event_id", ratingController.deleteEventRatings);

module.exports = router;
