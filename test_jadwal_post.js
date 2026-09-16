require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function testJadwalPost() {
    console.log("Testing Jadwal POST with hardcoded ID...");
    
    const newRecord = {
        id_jadwal: 9999, // try to bypass sequence
        tanggal_pelayanan: '2026-09-20',
        jam_pelayanan: '17:00:00',
        kategori: 'Pelayanan',
        tanggal: '2026-09-20',
        waktu: '17:00:00',
        judul: 'Test Title'
    };

    const { data, error } = await supabase.from('jadwal').insert([newRecord]).select();
    if (error) {
        console.error("Error inserting jadwal:", error);
    } else {
        console.log("Success! Data:", data);
        
        // Clean up
        await supabase.from('jadwal').delete().eq('id_jadwal', 9999);
    }
}

testJadwalPost();
