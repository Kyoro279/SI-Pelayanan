require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('jadwal').select('*').limit(1);
    console.log("Data:", data, "Error:", error);
}
check();
