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

        // cek emailnya di db pengguna (baik user biasa maupun super admin agar mendapat id_pengguna & nama_lengkap)
        try {
            // nembak api backend buat ngecek email dan otentikasi login
            const resCheck = await fetch('/api/akun/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            if (resCheck.ok) {
                // kalo ketemu, simpen data usernya (termasuk untuk super admin)
                const checkData = await resCheck.json();
                window.userData = {
                    ...checkData,
                    email: email
                };
            } else if (!isSuperAdmin) {
                // kalo bukan super admin dan api ngembaliin error (misal ga ketemu), paksa logout
                const errorResponse = await resCheck.json().catch(() => ({}));
                const errorMessage = errorResponse.error || 'unauthorized';
                await supabase.auth.signOut();
                window.location.href = `/?error=${encodeURIComponent(errorMessage)}`;
                return null;
            } else {
                // fallback jika super admin belum tercatat di tabel pengguna
                const metadata = session.user.user_metadata || {};
                window.userData = {
                    id_pengguna: null,
                    nama_lengkap: metadata.full_name || email.split('@')[0],
                    email: email,
                    role: 'Admin'
                };
            }

            // kalo page ini butuh role admin tapi yg login bukan admin, kirim ke dashboard
            if (!isSuperAdmin && options.requireAdmin && window.userData && window.userData.role !== 'Admin') {
                alert('Akses Ditolak: Halaman ini hanya untuk Admin.');
                window.location.href = '/dashboard';
                return null;
            }
        } catch (errDb) {
            if (!isSuperAdmin) {
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
