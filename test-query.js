require('dotenv').config();
const supabase = require('./config/supabase');

async function testQuery() {
    const { data, error } = await supabase
        .from('pengguna')
        .select('*')
        .order('nama_lengkap', { ascending: true });

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("Supabase Data:", data);
    }
}
testQuery();
