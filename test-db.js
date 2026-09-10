require('dotenv').config();
const supabase = require('./config/supabase');

async function testRoles() {
    const testRoles = ['Worship Leader', 'Music Director', 'Servant'];
    
    for (const role of testRoles) {
        console.log(`Testing role: '${role}'`);
        const { data, error } = await supabase.from('pengguna').insert([{
            nama_lengkap: 'Test',
            email_gmail: `test_${role.replace(/\s+/g, '')}@test.com`,
            role: role,
            status_aktif: true
        }]);
        if (error) {
            console.log(`  Failed:`, error.message);
        } else {
            console.log(`  Success!`);
            // Clean up
            await supabase.from('pengguna').delete().eq('email_gmail', `test_${role.replace(/\s+/g, '')}@test.com`);
        }
    }
}
testRoles();
