/**
 * checkAuth.js
 * Script ini berfungsi untuk mengecek otentikasi user dan perannya (role)
 * secara terpusat.
 */

window.initAndCheckAuth = async function (options = {}) {
    try {
        // 1. Ambil config Supabase dari backend (termasuk daftar SUPERADMIN_EMAILS)
        const respons = await fetch('/api/config');
        const config = await respons.json();

        // 2. Buat instance global
        window.supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        const supabase = window.supabaseClient;

        // 3. Dapatkan sesi login saat ini
        const { data: { session } } = await supabase.auth.getSession();

        // 4. Jika tidak ada sesi (belum login), kembalikan ke halaman awal
        if (!session) {
            window.location.href = '/';
            return null;
        }

        // 5. Cek apakah user adalah Super Admin (dari backend)
        const email = session.user.email;
        const superAdmins = (config.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim());
        const isSuperAdmin = superAdmins.includes(email);

        window.isSuperAdmin = isSuperAdmin;
        window.userData = null;

        // 6. Jika BUKAN super admin, verifikasi ke database
        if (!isSuperAdmin) {
            try {
                const resCheck = await fetch(`/api/akun/check/${encodeURIComponent(email)}`);
                if (!resCheck.ok) {
                    await supabase.auth.signOut();
                    window.location.href = '/?error=unauthorized';
                    return null;
                }
                const checkData = await resCheck.json();
                window.userData = checkData.data;

                // Jika halaman ini membutuhkan role Admin, dan user bukan Admin
                if (options.requireAdmin && window.userData.role !== 'Admin') {
                    alert('Akses Ditolak: Halaman ini hanya untuk Admin.');
                    window.location.href = '/dashboard';
                    return null;
                }
            } catch (errDb) {
                await supabase.auth.signOut();
                window.location.href = '/?error=unauthorized';
                return null;
            }
        }

        // 7. Panggil callback khusus halaman jika ada
        if (typeof options.onSuccess === 'function') {
            options.onSuccess(session);
        }

        // 8. Tampilkan halaman jika tidak dicegah (default: tampilkan)
        if (options.showBody !== false) {
            document.body.style.display = '';
        }

        return session;
    } catch (err) {
        console.error("Gagal memuat auth:", err);
    }
};
