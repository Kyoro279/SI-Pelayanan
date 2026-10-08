// script buat ngecek auth sama role user
// dipanggil di setiap halaman selain login biar aman

window.initAndCheckAuth = async function (options = {}) {
    try {
        // narik config supabase sama list superadmin dari backend
        const respons = await fetch('/api/config');
        const config = await respons.json(); 

        // bikin client supabase global biar ga perlu bikin ulang di file lain
        window.supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        const supabase = window.supabaseClient; 

        // ngecek session login di lokal browser (cookie/storage)
        const { data: { session } } = await supabase.auth.getSession();

        // kalo belum login atau expired, tendang balik ke awal
        if (!session) {
            window.location.href = '/'; 
            return null; 
        }

        // ambil email dari session buat ngecek dia super admin apa bukan
        const email = session.user.email;
        const superAdmins = (config.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim());
        const isSuperAdmin = superAdmins.includes(email);

        // simpen statusnya di global
        window.isSuperAdmin = isSuperAdmin;
        window.userData = null; 

        // kalo bukan super admin, kita cek emailnya ada ga di db pengguna
        if (!isSuperAdmin) {
            try {
                // nembak api backend buat ngecek email
                const resCheck = await fetch(`/api/akun/check/${encodeURIComponent(email)}`);
                
                // kalo api ngembaliin error (misal ga ketemu), paksa logout
                if (!resCheck.ok) {
                    await supabase.auth.signOut(); 
                    window.location.href = '/?error=unauthorized'; 
                    return null; 
                }
                
                // kalo ketemu, simpen data usernya
                const checkData = await resCheck.json();
                window.userData = checkData.data; 

                // kalo page ini butuh role admin tapi yg login bukan admin, kirim ke dashboard
                if (options.requireAdmin && window.userData.role !== 'Admin') {
                    alert('Akses Ditolak: Halaman ini hanya untuk Admin.'); 
                    window.location.href = '/dashboard'; 
                    return null;
                }
            } catch (errDb) {
                // kalo ada error sistem (koneksi dsb)
                await supabase.auth.signOut(); 
                window.location.href = '/?error=unauthorized'; 
                return null;
            }
        }

        // jalanin callback bawaan dari halaman (kalo ada)
        if (typeof options.onSuccess === 'function') {
            options.onSuccess(session); 
        }

        // nampilin halaman yg aslinya kita hide di html
        if (options.showBody !== false) {
            document.body.style.display = ''; 
        }

        return session; 
    } catch (err) {
        console.error("Gagal memuat auth:", err); 
    }
};
