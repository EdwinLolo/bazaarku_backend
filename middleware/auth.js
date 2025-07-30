const supabase = require("../db/supabase");

async function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  // console.log("Auth header:", authHeader);
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  // console.log("Token:", token);

  try {
    // Get user from token
    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );

    // console.log("User data:", userData);

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from("User")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: "User profile not found" });
    }

    req.user = {
      ...userData.user,
      role: profile.role,
      profile: profile,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

// Role-based middleware
function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // If no roles specified, just check if user is authenticated
    if (roles.length === 0) {
      return next();
    }

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access forbidden",
        message: `Required role: ${roles.join(" or ")}, Your role: ${
          req.user.role
        }`,
      });
    }

    next();
  };
}

// Specific role middlewares
const requireAdmin = authorize(["admin"]);
const requireVendor = authorize(["teacher", "admin"]);
const requireUser = authorize(["student", "teacher", "admin"]);
const requireVendorOrAdmin = authorize(["teacher", "admin"]);

module.exports = {
  authenticate,
  authorize,
  requireAdmin,
  requireVendor,
  requireUser,
  requireVendorOrAdmin,
};
