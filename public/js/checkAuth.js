// script buat ngecek auth sama role user
// dipanggil di setiap halaman selain login biar aman

const CONFIG_CACHE_KEY = 'kitteens_app_config_v1';
const USER_CACHE_KEY = 'kitteens_user_data_v1';

window.initAndCheckAuth = async function (options = {}) {
    try {
        // 1. ambil config supabase dari cache sessionStorage dulu supaya pindah halaman instan (tidak nunggu network)
        let config = null;
        try {
            const cachedConfig = sessionStorage.getItem(CONFIG_CACHE_KEY);
            if (cachedConfig) config = JSON.parse(cachedConfig);
        } catch (_) { }

        if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            const respons = await fetch('/api/config');
            config = await respons.json();
            try {
                sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
            } catch (_) { }
        }

        // bikin client supabase global biar ga perlu bikin ulang di file lain
        window.supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        const supabase = window.supabaseClient;

        // ngecek session login di lokal browser (cookie/storage)
        const { data: { session } } = await supabase.auth.getSession();

        // kalo belum login atau expired, tendang balik ke awal
        if (!session) {
            try { sessionStorage.removeItem(USER_CACHE_KEY); } catch (_) { }
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

        // 2. cek apakah data profil user untuk email ini sudah ada di sessionStorage
        let cachedUser = null;
        try {
            const rawUserCache = sessionStorage.getItem(USER_CACHE_KEY);
            if (rawUserCache) {
                const parsed = JSON.parse(rawUserCache);
                if (parsed && parsed.email === email) {
                    cachedUser = parsed;
                }
            }
        } catch (_) { }

        if (cachedUser) {
            window.userData = cachedUser;
        } else {
            // cek emailnya di db pengguna (hanya saat pertama kali login / cache belum ada)
            try {
                const resCheck = await fetch('/api/akun/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });

                if (resCheck.ok) {
                    const checkData = await resCheck.json();
                    window.userData = {
                        ...checkData,
                        email: email
                    };
                    try {
                        sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(window.userData));
                    } catch (_) { }
                } else if (!isSuperAdmin) {
                    const errorResponse = await resCheck.json().catch(() => ({}));
                    const errorMessage = errorResponse.error || 'unauthorized';
                    try { sessionStorage.removeItem(USER_CACHE_KEY); } catch (_) { }
                    await supabase.auth.signOut();
                    window.location.href = `/?error=${encodeURIComponent(errorMessage)}`;
                    return null;
                } else {
                    const metadata = session.user.user_metadata || {};
                    window.userData = {
                        id_pengguna: null,
                        nama_lengkap: metadata.full_name || email.split('@')[0],
                        email: email,
                        role: 'Admin'
                    };
                    try {
                        sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(window.userData));
                    } catch (_) { }
                }
            } catch (errDb) {
                if (!isSuperAdmin) {
                    await supabase.auth.signOut();
                    window.location.href = '/?error=unauthorized';
                    return null;
                }
            }
        }

        // kalo page ini butuh role admin tapi yg login bukan admin, kirim ke dashboard
        if (!isSuperAdmin && options.requireAdmin && window.userData && window.userData.role !== 'Admin') {
            alert('Akses Ditolak: Halaman ini hanya untuk Admin.');
            window.location.href = '/dashboard';
            return null;
        }

        // pastikan elemen HTML di dalam <body> sudah selesai di-parse oleh browser sebelum menjalankan onSuccess
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }

        // nampilin halaman yg aslinya kita hide di html
        if (options.showBody !== false && document.body) {
            document.body.style.display = '';
        }

        // jalanin callback bawaan dari halaman (kalo ada)
        if (typeof options.onSuccess === 'function') {
            try {
                options.onSuccess(session);
            } catch (cbErr) {
                console.error("Error pada callback onSuccess:", cbErr);
            }
        }

        return session;
    } catch (err) {
        console.error("Gagal memuat auth:", err);
        if (document.body) {
            document.body.style.display = '';
        }
    }
};
