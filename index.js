const express = require("express");
const dotenv = require("dotenv");
const supabase = require("./supabaseClient");
const cors = require("cors");

const app = express();

dotenv.config();
app.use(express.json()); // Middleware to parse JSON bodies

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
};

const PORT = process.env.PORT;
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from("area").select("*").limit(1);

    if (error) {
      console.log("Supabase connection failed:", error.message);
    } else {
      console.log("Connected to Supabase database!");
      // app.listen(PORT, () => {
      //   console.log(`Server is running on port ${PORT}`);
      // });
    }
  } catch (error) {
    console.log("Connection failed:", error.message);
  }
};

testConnection();

app.get("/api/hello", (req, res) => {
  res.send("Hello World");
});

app.get("/", (req, res) => {
  res.send("Welcome to the Bazaarku Backend API");
});
