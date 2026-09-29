/**
 * Fungsi utama untuk menyiapkan fitur Login
 * Alur Kerja:
 * 1. Menarik konfigurasi (URL & KEY) Supabase dari backend.
 * 2. Menginisialisasi koneksi ke Supabase.
 * 3. Mengecek jika sebelumnya user ditolak masuk (karena email tidak terdaftar).
 * 4. Mendaftarkan aksi klik pada tombol "Login dengan Google".
 */
async function setupLogin() {
    try {
        // LAKAH 1: Mengambil kunci Supabase dari server (yang membaca dari file .env)
        // Endpoint '/api/config' dibuat di server.js
        const respons = await fetch('/api/config');
        const config = await respons.json();

        // Cek jika kunci gagal diambil (misalnya .env kosong atau salah)
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            alert("Kunci Supabase belum terhubung! Cek file .env Anda.");
            return;
        }

        // LANGKAH 2: Membuat koneksi/instance client ke Supabase menggunakan library @supabase/supabase-js
        const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

        // LANGKAH 3: Cek parameter URL (Apakah ada ?error=unauthorized)
        // Ini terjadi jika user berhasil login Google, tapi email-nya tidak ada di database "pengguna" kita.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('error') === 'unauthorized') {
            // Tampilkan pesan error warna merah di HTML
            const errorMsg = document.getElementById('error-msg');
            if (errorMsg) errorMsg.style.display = 'block';
            
            // Bersihkan URL bar dari parameter ?error... agar lebih rapi
            window.history.replaceState({}, document.title, "/");
        }

        // LANGKAH 4: Menangani tombol "Login dengan Google"
        const btnLogin = document.getElementById('btn-login-google');
        if (btnLogin) {
            btnLogin.addEventListener('click', async () => {
                // Memanggil fungsi bawaan Supabase untuk OAuth (Login pihak ketiga)
                // Ini akan memicu popup/redirect ke halaman Login Google yang asli
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        // Jika login Google sukses, Google akan mengembalikan user ke URL ini:
                        // Yaitu halaman Dashboard aplikasi kita.
                        redirectTo: 'http://localhost:3000/dashboard'
                    }
                });

                // Jika proses inisiasi login gagal (misal tidak ada internet), tangkap errornya
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

// Menjalankan fungsi setupLogin() saat file JS ini pertama kali dimuat oleh HTML
setupLogin();
