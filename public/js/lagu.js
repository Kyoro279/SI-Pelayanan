// public/js/lagu.js

// Variabel global untuk nyimpen semua lagu yang ditarik dari database
// Biar nanti gampang kalau mau nge-filter (search atau pilih kategori) tanpa perlu manggil API lagi
let allSongs = [];
// Variabel buat ngecek apakah user ini admin/music director yang boleh nambah/hapus lagu
let canManageLagu = false;

// Event ini bakal jalan otomatis pas halaman HTML selesai di-load semua
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth & Role
    // Cek dulu siapa yang lagi login, punya akses apa aja
    await initAuthPermissions();

    // 2. Setup Event Listeners
    // Pasang "pendengar" ke kolom pencarian dan filter dropdown
    setupEventListeners();

    // 3. Fetch data lagu
    // Mulai narik data lagu dari backend
    await fetchSongs();
});

/**
 * Cek autentikasi dan hak akses role
 * Fungsi ini bertugas buat nentuin tombol "Tambah Lagu" atau "Hapus" bakal ditampilin atau nggak
 */
async function initAuthPermissions() {
    // Tungguin kalau proses auth dari layout.js belum beres
    if (window.authReady) {
        await window.authReady;
    }

    // Ambil role user dari session, kalau nggak ada berarti guest
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');

    // Yang boleh manage lagu itu super admin, admin biasa, atau music director
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    // Cari tombol tambah lagu yang ada di pojok kanan atas
    const btnTambah = document.querySelector('.btn-primary');
    // Kalau dia bukan admin, tombol tambahnya diumpetin (disembunyikan)
    if (btnTambah && !canManageLagu) {
        btnTambah.style.display = 'none';
    }
}

// Fungsi buat nyambungin kolom search dan filter kategori sama fungsi filternya
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    // Tiap kali user ngetik di kolom search, langsung panggil fungsi filterSongs
    if (searchInput) {
        searchInput.addEventListener('input', filterSongs);
    }
    // Tiap kali user ganti pilihan kategori di dropdown, panggil filterSongs juga
    if (filterCategory) {
        filterCategory.addEventListener('change', filterSongs);
    }
}

// Fungsi utama buat ngambil data dari API
async function fetchSongs() {
    const songGrid = document.getElementById('songGrid');
    const subtitle = document.querySelector('.subtitle');

    // Kasih efek loading muter-muter dulu biar user tau lagi proses ngambil data
    if (songGrid) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                <i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i>
                <p>Memuat data lagu...</p>
            </div>
        `;
    }

    try {
        // Panggil API /api/lagu pake metode GET
        const response = await fetch('/api/lagu');
        // Kalau error dari server (misal 500), lempar error
        if (!response.ok) throw new Error('Gagal mengambil data lagu');

        // Ubah responsenya jadi format JSON
        const result = await response.json();
        // Simpan datanya ke variabel global allSongs
        allSongs = result.data || [];

        // Lempar datanya ke fungsi render buat digambar di HTML
        renderSongs(allSongs);

        // Update teks kecil di bawah judul, misal "10 Lagu Tersedia"
        if (subtitle) {
            subtitle.textContent = `${allSongs.length} Lagu Tersedia`;
        }
    } catch (error) {
        // Kalau error (misal jaringan putus), tampilin pesan error di layar
        console.error('Error fetching songs:', error);
        if (songGrid) {
            songGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ef4444;">
                    <i class="ph ph-warning-circle" style="font-size: 2rem;"></i>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

// Fungsi buat nge-gambar (render) sekumpulan lagu jadi komponen Card di HTML
function renderSongs(songs) {
    const songGrid = document.getElementById('songGrid');
    if (!songGrid) return; // Kalau tempatnya ga ada, di stop

    // Kalau array lagunya kosong (misal hasil pencarian nggak nemu), kasih tau user
    if (songs.length === 0) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
                <i class="ph ph-music-notes-simple" style="font-size: 3rem;"></i>
                <p style="margin-top: 10px;">Belum ada lagu yang sesuai.</p>
            </div>
        `;
        return;
    }

    // Bersihin layar dari daftar sebelumnya (atau dari loading text)
    songGrid.innerHTML = '';

    // Lakukan pengulangan buat tiap lagu yang ada di array
    songs.forEach(song => {
        // Bikin elemen div baru
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-category', song.kategori || 'Worship');
        card.style.cursor = 'pointer';

        // Kalau card ini diklik, otomatis pindah halaman ke detail-lagu bawa parameter ID lagunya
        card.addEventListener('click', () => {
            window.location.href = `/detail-lagu?id=${song.id}`;
        });

        // Ambil nada dasar, kalau kosong kasih tanda strip aja
        const key = song.nada_dasar ? song.nada_dasar : '-';

        // Isi struktur HTML ke dalem div card-nya
        card.innerHTML = `
            <div class="top-section">
                <div class="card-icon">
                    <i class="ph-fill ph-music-note"></i>
                </div>
                <div class="card-key">${escapeHtml(key)}</div>
            </div>
            <div class="bottom-section">
                <div class="card-details">
                    <h3 class="song-title">${escapeHtml(song.judul)}</h3>
                    <p class="song-artist">${escapeHtml(song.penyanyi || 'Unknown Artist')}</p>
                </div>
                <!-- Cuma nampilin tombol delete kalau usernya punya akses -->
                ${canManageLagu ? `
                <button class="btn-delete" title="Hapus Lagu">
                    <i class="ph-bold ph-trash"></i>
                </button>
                ` : ''}
            </div>
        `;

        // Pasangin event listener buat tombol delete (ikon tong sampah)
        const btnDelete = card.querySelector('.btn-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', (e) => {
                // Biar pas ngeklik tong sampah, card-nya ga ikut ngeklik ke halaman detail (stop event bubbling)
                e.stopPropagation();
                confirmDelete(song.id, song.judul);
            });
        }

        // Tempelin card yang udah jadi ini ke container grid-nya
        songGrid.appendChild(card);
    });
}

// Fungsi buat nyaring (filter) lagu berdasarkan apa yang diketik dan dipilih di dropdown
function filterSongs() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    // Ambil teks yang diketik, langsung jadiin huruf kecil semua biar pencariannya gak case-sensitive
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    // Ambil value dari dropdown, kalau 'all' berarti nampilin semua
    const selectedCategory = filterCategory ? filterCategory.value : 'all';

    // Bikin array baru (filtered) dari array allSongs
    const filtered = allSongs.filter(song => {
        const title = (song.judul || '').toLowerCase();
        const artist = (song.penyanyi || '').toLowerCase();
        const category = song.kategori || 'Worship';

        // Cek apakah judul atau penyanyinya mengandung kata yang diketik
        const matchesSearch = title.includes(searchTerm) || artist.includes(searchTerm);
        // Cek apakah kategorinya sesuai sama yang dipilih
        const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

        // Lagu ini dimasukin ke array 'filtered' cuma kalau lulus dua syarat di atas
        return matchesSearch && matchesCategory;
    });

    // Lempar data yang udah disaring ke fungsi render biar tampilannya update
    renderSongs(filtered);
}

// Fungsi buat konfirmasi dan hapus lagu
async function confirmDelete(id, judul) {
    // Pake confirm bawaan browser biar ada pop-up Yes/No
    const isConfirm = confirm(`Apakah Anda yakin ingin menghapus lagu "${judul}"?`);
    if (!isConfirm) return; // Kalau pilih 'Cancel', stop fungsi ini

    try {
        // Tembak API delete dengan masukin ID lagunya ke URL
        const res = await fetch(`/api/lagu/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus lagu');

        // Kalau berhasil dihapus di database, tarik ulang data lagu terbaru biar layarnya update
        await fetchSongs();
    } catch (err) {
        // Kalau gagal ngehapus (koneksi putus/ada error), kasih alert
        alert('Gagal menghapus lagu: ' + err.message);
    }
}

/**
 * Helper escape HTML
 * Ini trik keamanan biar kalau ada user iseng ngetik script javascript di judul lagu (<script>alert(1)</script>),
 * browser gak akan jalanin scriptnya, melainkan cuma nampilin tulisannya doang.
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
