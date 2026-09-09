async function setupLogin() {
    try {
        // 1. Mengambil kunci Supabase dari server (yang membaca file .env)
        const respons = await fetch('/api/config');
        const config = await respons.json();

        // Cek jika kunci gagal diambil
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            alert("Kunci Supabase belum terhubung! Cek file .env Anda.");
            return;
        }

        // 2. Hubungkan ke Supabase dengan kunci yang didapat
        const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

        // 3. Logika tombol login
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

// Jalankan fungsi
setupLogin();
