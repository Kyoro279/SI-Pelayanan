async function setupLogin() {
    try {
        // narik config supabase dari server
        const respons = await fetch('/api/config');
        const config = await respons.json();

        // cek kalo gagal dapet kunci
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            alert("Kunci Supabase belum terhubung! Cek file .env Anda.");
            return;
        }

        // inisialisasi client supabase
        const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

        // nanganin aksi klik tombol login
        const btnLogin = document.getElementById('btn-login-google');
        if (btnLogin) {
            btnLogin.addEventListener('click', async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: 'http://localhost:3000/dashboard' 
                    }
                });

                if (error) {
                    console.error("Gagal login:", error.message);
                    alert("Terjadi kesalahan saat mencoba login Google.");
                }
            });
        }
    } catch (err) {
        console.error("Gagal menyiapkan login:", err);
    }
}

// jalanin langsung pas file ini diload
setupLogin();