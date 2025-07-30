const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Check if environment variables are available
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("Missing Supabase environment variables!");
  console.error(
    "Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file"
  );
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = supabase;
