require('dotenv').config();
console.log("Service Key starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 15) : 'undefined');

const supabase = require('./config/supabase');

async function check() {
    const { data, error } = await supabase.from('jadwal').select('*').limit(1);
    console.log("Jadwal select:", { data, error });
    
    const { data: d2, error: e2 } = await supabase.from('lagu').select('*').limit(1);
    console.log("Lagu select:", { data: d2, error: e2 });
}
check();
