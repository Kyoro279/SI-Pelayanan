// file buat nyiapin halaman login
// nyambungin aplikasi kita sama supabase & google
async function setupLogin() {
    try {
        // narik config (url & key) supabase dari backend (server.js baca dari .env)
        // soalnya bahaya kalo ditaro langsung di front-end
        const respons = await fetch('/api/config');
        const config = await respons.json();

        // kalo misal .env kosong atau typo, stop prosesnya
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            alert("Kunci Supabase belum terhubung! Cek file .env Anda.");
            return; 
        }

        // inisialisasi client supabase pake kunci tadi
        const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        
        if (errorParam) {
            // munculin teks error merah
            const errorMsg = document.getElementById('error-msg');
            if (errorMsg) {
                if (errorParam !== 'unauthorized') {
                    errorMsg.innerText = errorParam; // Menampilkan pesan error spesifik
                }
                errorMsg.style.display = 'block'; 
            }
            
            // bersihin url bar biar ga keliatan kotor
            window.history.replaceState({}, document.title, "/");
        }

        // pasang aksi klik di tombol google
        const btnLogin = document.getElementById('btn-login-google');
        
        if (btnLogin) {
            btnLogin.addEventListener('click', async () => {
                
                // panggil oauth supabase buat buka popup halaman resmi google
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google', 
                    options: {
                        // kalo sukses, lempar user ke halaman dashboard
                        redirectTo: 'http://localhost:3000/dashboard'
                    }
                });

                // kalo gagal manggil (misal inet putus)
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

// langsung jalanin pas dipanggil di html
setupLogin();
