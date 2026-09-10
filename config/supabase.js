// config/supabase.js
const { createClient } = require('@supabase/supabase-js');

// Mengambil kunci dari file .env
const supabaseUrl = process.env.SUPABASE_URL;
// Gunakan Service Role Key untuk backend agar mem-bypass RLS (jika ada)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;