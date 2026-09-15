require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testJadwalPost() {
    console.log("Testing Jadwal POST...");
    
    const newRecord = {
        kategori: 'Pelayanan',
        tanggal: '2026-09-20',
        waktu: '17:00',
        judul: 'Test Title',
        tujuan: 'Test Tujuan',
        pengkotbah: 'Test Pengkotbah',
        tim_pelayanan: { "worship_leader": "Test WL" }
    };

    const { data, error } = await supabase.from('jadwal').insert([newRecord]).select();
    if (error) {
        console.error("Error inserting jadwal:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

testJadwalPost();
