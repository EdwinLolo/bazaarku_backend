const express = require("express");
const router = express.Router();
const controller = require("../controllers/index.js");
const {
  authenticate,
  requireAdmin,
  requireVendor,
  requireVendorOrAdmin,
} = require("../middleware/auth.js");

// Signup
router.get("/signup", controller.auth.testingauth);
router.post("/signup", controller.auth.signup);

// Login
router.post("/login", controller.auth.login);

// Logout
router.post("/logout", authenticate, controller.auth.logout);

// Admin only routes
router.get(
  "/admin/users",
  authenticate,
  requireAdmin,
  controller.auth.GetAdminAllUsers
);

// // Teacher and Admin routes
// router.get(
//   "/teacher/dashboard",
//   authenticate,
//   requireVendorOrAdmin,
//   (req, res) => {
//     res.json({ message: "Teacher dashboard", user: req.user });
//   }
// );

// // Admin route to change user roles
// router.put(
//   "/admin/users/:userId",
//   authenticate,
//   requireAdmin,
//   controller.auth.AdminChangeUserRole
// );

// router.delete(
//   "/admin/users/:userId",
//   authenticate,
//   requireAdmin,
//   controller.auth.AdminDeleteUser
// );

// router.get("/admin-only", authenticate, requireAdmin, (req, res) => {
//   res.json({ message: "Admin access granted" });
// });

module.exports = router;
