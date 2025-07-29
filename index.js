const express = require("express");
const dotenv = require("dotenv");
const supabase = require("./supabaseClient");

const app = express();

dotenv.config();
app.use(express.json()); // Middleware to parse JSON bodies

const PORT = process.env.PORT;
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from("area").select("*").limit(1);

    if (error) {
      console.log("Supabase connection failed:", error.message);
    } else {
      console.log("Connected to Supabase database!");
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.log("Connection failed:", error.message);
  }
};

testConnection();

app.get("/", (req, res) => {
  res.send("Hello World");
});
