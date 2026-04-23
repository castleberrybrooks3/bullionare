import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

console.log("SUPABASE URL =", supabaseUrl);
console.log("SUPABASE KEY =", supabaseKey);

export const supabase = createClient(supabaseUrl, supabaseKey);