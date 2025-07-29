const express = require("express");
const dotenv = require("dotenv");
const supabase = require("./supabaseClient");
const cors = require("cors");

// Load environment variables first
dotenv.config();

const app = express();

// Middleware
app.use(express.json()); // Middleware to parse JSON bodies

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS not allowed for origin: ${origin}`));
    }
  },
};

app.use(cors(corsOptions));

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from("area").select("*").limit(1);
    if (error) {
      console.log("Supabase connection failed:", error.message);
      return false;
    } else {
      console.log("Connected to Supabase database!");
      return true;
    }
  } catch (error) {
    console.log("Connection failed:", error.message);
    return false;
  }
};

// Routes
app.get("/api/hello", (req, res) => {
  res.send("Hello World");
});

app.get("/", (req, res) => {
  res.send("Welcome to the Bazaarku Backend API");
});

// Start server
const startServer = async () => {
  // Test connection first (optional)
  await testConnection();
};

startServer();
