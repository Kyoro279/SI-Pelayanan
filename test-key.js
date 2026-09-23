require('dotenv').config();
const supabase = require('./config/supabase');
console.log('SUPABASE_SERVICE_ROLE_KEY defined in env?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Is it using service role key?', supabase.supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY);
