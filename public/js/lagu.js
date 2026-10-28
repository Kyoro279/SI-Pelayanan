//public/js/lagu.js

//variabel global untuk nyimpen semua lagu yang ditarik dari database
//biar nanti gampang kalau mau nge-filter (search atau pilih kategori) tanpa perlu manggil API lagi
let allSongs = [];
//variabel buat ngecek apakah user ini admin/music director yang boleh nambah/hapus lagu
let canManageLagu = false;

//event ini bakal jalan otomatis pas halaman HTML selesai di-load semua
document.addEventListener('DOMContentLoaded', async () => {
    //inisialisasi auth & role
    //cek dulu siapa yang lagi login, punya akses apa aja
    await initAuthPermissions();

    //setup event listeners
    //pasang "pendengar" ke kolom pencarian dan filter dropdown
    setupEventListeners();

    //fetch data lagu
    //mulai narik data lagu dari backend
    await fetchSongs();
});

//cek autentikasi dan hak akses role
//fungsi ini bertugas buat nentuin tombol "Tambah Lagu" atau "Hapus" bakal ditampilin atau nggak
async function initAuthPermissions() {
    //tungguin kalau proses auth dari layout.js belum beres
    if (window.authReady) {
        await window.authReady;
    }

    //ambil role user dari session, kalau nggak ada berarti guest
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');

    //yang boleh manage lagu itu super admin, admin biasa, atau music director
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    //cari tombol tambah lagu yang ada di pojok kanan atas
    const btnTambah = document.querySelector('.btn-primary');
    //kalau dia bukan admin, tombol tambahnya diumpetin (disembunyikan)
    if (btnTambah && !canManageLagu) {
        btnTambah.style.display = 'none';
    }
}

//fungsi buat nyambungin kolom search dan filter kategori sama fungsi filternya
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    //tiap kali user ngetik di kolom search, langsung panggil fungsi filterSongs
    if (searchInput) {
        searchInput.addEventListener('input', filterSongs);
    }
    //tiap kali user ganti pilihan kategori di dropdown, panggil filterSongs juga
    if (filterCategory) {
        filterCategory.addEventListener('change', filterSongs);
    }
}

//fungsi utama buat ngambil data dari API
async function fetchSongs() {
    const songGrid = document.getElementById('songGrid');
    const subtitle = document.querySelector('.subtitle');

    //kasih efek loading muter-muter dulu biar user tau lagi proses ngambil data
    if (songGrid) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                <i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i>
                <p>Memuat data lagu...</p>
            </div>
        `;
    }

    try {
        //panggil API /api/lagu pake metode GET
        const response = await fetch('/api/lagu');
        //kalau error dari server (misal 500), lempar error
        if (!response.ok) throw new Error('Gagal mengambil data lagu');

        //ubah responsenya jadi format JSON
        const result = await response.json();
        //simpan datanya ke variabel global allSongs
        allSongs = result.data || [];

        //lempar datanya ke fungsi render buat digambar di HTML
        renderSongs(allSongs);

        //update teks kecil di bawah judul, misal "10 Lagu Tersedia"
        if (subtitle) {
            subtitle.textContent = `${allSongs.length} Lagu Tersedia`;
        }
    } catch (error) {
        //kalau error (misal jaringan putus), tampilin pesan error di layar
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

//fungsi buat nge-gambar (render) sekumpulan lagu jadi komponen Card di HTML
function renderSongs(songs) {
    const songGrid = document.getElementById('songGrid');
    if (!songGrid) return; //kalau tempatnya ga ada, di stop

    //kalau array lagunya kosong (misal hasil pencarian nggak nemu), kasih tau user
    if (songs.length === 0) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
                <i class="ph ph-music-notes-simple" style="font-size: 3rem;"></i>
                <p style="margin-top: 10px;">Belum ada lagu yang sesuai.</p>
            </div>
        `;
        return;
    }

    //bersihin layar dari daftar sebelumnya (atau dari loading text)
    songGrid.innerHTML = '';

    //lakukan pengulangan buat tiap lagu yang ada di array
    songs.forEach(song => {
        const songId = song.id_lagu || song.id;
        const songTitle = song.judul_lagu || song.judul || 'Tanpa Judul';
        const songArtist = song.pengarang || song.penyanyi || 'Unknown Artist';
        const rawKey = song.nada_dasar ? String(song.nada_dasar).trim() : '-';

        //bikin elemen div baru
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-category', song.kategori || 'Worship');
        card.style.cursor = 'pointer';

        //kalau card ini diklik, otomatis pindah halaman ke detail-lagu bawa parameter ID lagunya
        card.addEventListener('click', () => {
            window.location.href = `/detail-lagu?id=${songId}`;
        });

        //ambil nada dasar yang udah di-trim
        const key = rawKey || '-';

        //isi struktur HTML ke dalem div card-nya
        card.innerHTML = `
            <div class="top-section">
                <div class="card-icon">
                    <i class="ph-fill ph-music-note"></i>
                </div>
                <div class="card-key">${escapeHtml(key)}</div>
            </div>
            <div class="bottom-section">
                <div class="card-details">
                    <h3 class="song-title">${escapeHtml(songTitle)}</h3>
                    <p class="song-artist">${escapeHtml(songArtist)}</p>
                </div>
                <!--cuma nampilin tombol delete kalau usernya punya akses-->
                ${canManageLagu ? `
                <button class="btn-delete" title="Hapus Lagu">
                    <i class="ph-bold ph-trash"></i>
                </button>
                ` : ''}
            </div>
        `;

        //pasangin event listener buat tombol delete (ikon tong sampah)
        const btnDelete = card.querySelector('.btn-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', (e) => {
                //biar pas ngeklik tong sampah, card-nya ga ikut ngeklik ke halaman detail (stop event bubbling)
                e.stopPropagation();
                confirmDelete(songId, songTitle);
            });
        }

        //tempelin card yang udah jadi ini ke container grid-nya
        songGrid.appendChild(card);
    });
}

//fungsi buat nyaring (filter) lagu berdasarkan apa yang diketik dan dipilih di dropdown
function filterSongs() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    //ambil teks yang diketik, langsung jadiin huruf kecil semua biar pencariannya gak case-sensitive
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    //ambil value dari dropdown, kalau 'all' berarti nampilin semua
    const selectedCategory = filterCategory ? filterCategory.value : 'all';

    //bikin array baru (filtered) dari array allSongs
    const filtered = allSongs.filter(song => {
        const title = (song.judul_lagu || song.judul || '').toLowerCase();
        const artist = (song.pengarang || song.penyanyi || '').toLowerCase();
        const category = song.kategori || 'Worship';

        //cek apakah judul atau penyanyinya mengandung kata yang diketik
        const matchesSearch = title.includes(searchTerm) || artist.includes(searchTerm);
        //cek apakah kategorinya sesuai sama yang dipilih
        const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

        //lagu ini dimasukin ke array 'filtered' cuma kalau lulus dua syarat di atas
        return matchesSearch && matchesCategory;
    });

    //lempar data yang udah disaring ke fungsi render biar tampilannya update
    renderSongs(filtered);
}

//fungsi buat konfirmasi dan hapus lagu
async function confirmDelete(id, judul) {
    //pake confirm bawaan browser biar ada pop-up Yes/No
    const isConfirm = confirm(`Apakah Anda yakin ingin menghapus lagu "${judul}"?`);
    if (!isConfirm) return; //kalau pilih 'Cancel', stop fungsi ini

    try {
        //tembak API delete dengan masukin ID lagunya ke URL
        const res = await fetch(`/api/lagu/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus lagu');

        //kalau berhasil dihapus di database, tarik ulang data lagu terbaru biar layarnya update
        await fetchSongs();
    } catch (err) {
        //kalau gagal ngehapus (koneksi putus/ada error), kasih alert
        alert('Gagal menghapus lagu: ' + err.message);
    }
}

//helper escape HTML
//ini trik keamanan biar kalau ada user iseng ngetik script javascript di judul lagu (<script>alert(1)</script>),
//browser gak akan jalanin scriptnya, melainkan cuma nampilin tulisannya doang.
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
