const express = require("express");
const dotenv = require("dotenv");
const supabase = require("./db/supabase");
const cors = require("cors");
const path = require("path");

dotenv.config();

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Route imports
const authRoute = require("./routes/auth_route.js");
const rentalRoute = require("./routes/rental_route.js");
const bannerRoute = require("./routes/banner_route.js");
const eventCategoryRoute = require("./routes/event_category_route.js");
const areaRoute = require("./routes/area_route.js");
const vendorRoute = require("./routes/vendor_route.js");
const boothRoute = require("./routes/booth_route.js");
const eventRoute = require("./routes/event_route.js");

app.use(authRoute);
app.use(rentalRoute);
app.use(bannerRoute);
app.use(eventCategoryRoute);
app.use(areaRoute);
app.use(vendorRoute);
app.use(boothRoute);
app.use(eventRoute);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS not allowed for origin: ${origin}`));
    }
  },
};

app.use(cors(corsOptions));

// Test database connection (optional for serverless)
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from("area").select("*").limit(1);
    if (error) {
      console.log("Supabase connection failed:", error.message);
    } else {
      console.log("Connected to Supabase database!");
    }
  } catch (error) {
    console.log("Connection failed:", error.message);
  }
};

testConnection();

// Routes
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello World" });
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Bazaarku Backend API" });
});

app.get("/api", (req, res) => {
  res.json({ message: "API is working!" });
});

// Export for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
