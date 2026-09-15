require('dotenv').config();

async function checkSchema() {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY}`);
    const data = await res.json();
    const jadwalDef = data.definitions.jadwal;
    console.log(JSON.stringify(jadwalDef, null, 2));
}
checkSchema();
