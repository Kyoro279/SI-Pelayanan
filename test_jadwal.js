require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJadwal() {
    console.log("Testing Jadwal Query...");
    const { data, error } = await supabase.from('jadwal').select('*');
    if (error) {
        console.error("Error querying jadwal:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

testJadwal();
