require('dotenv').config();
const supabase = require('./config/supabase');

async function check() {
    const { data, error } = await supabase.from('pengguna').select('*');
    console.log("Data:", data);
    console.log("Error:", error);
}

check();
