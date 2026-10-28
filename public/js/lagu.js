//public/js/lagu.js

//variabel global buat nyimpen semua lagu yang ditarik dari database
let allSongs = [];
//variabel buat ngecek apakah user punya akses buat tambah/hapus lagu
let canManageLagu = false;

//jalanin fungsi utama waktu halaman HTML udah beres dimuat
document.addEventListener('DOMContentLoaded', async () => {
    //cek status login dan role user dulu
    await initAuthPermissions();
    //pasang event listener ke kolom search dan dropdown kategori
    setupEventListeners();
    //tarik data lagu dari backend buat ditampilin ke layar
    await fetchSongs();
});

//fungsi buat ngecek autentikasi dan hak akses role user
async function initAuthPermissions() {
    //tunggu proses cek auth dari layout.js selesai dulu
    if (window.authReady) {
        await window.authReady;
    }

    //ambil role user dari session, kalau belum ada anggap guest
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    //yang boleh kelola lagu cuma super admin, admin, atau music director
    canManageLagu = window.isSuperAdmin || role === 'admin' || role === 'music director';

    //sembunyiin tombol tambah lagu kalau user nggak punya akses
    const btnTambah = document.querySelector('.btn-primary');
    if (btnTambah && !canManageLagu) {
        btnTambah.style.display = 'none';
    }
}

//fungsi buat nyambungin input pencarian dan filter kategori
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    //filter ulang daftar lagu tiap kali user ngetik di kolom pencarian
    if (searchInput) searchInput.addEventListener('input', filterSongs);
    //filter ulang daftar lagu tiap kali pilihan kategori diubah
    if (filterCategory) filterCategory.addEventListener('change', filterSongs);
}

//fungsi buat ngambil data semua lagu dari endpoint API
async function fetchSongs() {
    const songGrid = document.getElementById('songGrid');
    const subtitle = document.querySelector('.subtitle');

    //tampilin animasi loading selama data lagi diambil dari server
    if (songGrid) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                <i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i>
                <p>Memuat data lagu...</p>
            </div>
        `;
    }

    try {
        //panggil API daftar lagu
        const response = await fetch('/api/lagu');
        if (!response.ok) throw new Error('Gagal mengambil data lagu');

        //ubah response jadi JSON lalu simpan ke array global allSongs
        const result = await response.json();
        allSongs = result.data || [];

        //render semua lagu ke halaman
        renderSongs(allSongs);

        //update teks jumlah lagu yang tersedia di bagian bawah judul halaman
        if (subtitle) {
            subtitle.textContent = `${allSongs.length} Lagu Tersedia`;
        }
    } catch (error) {
        //kalau gagal ambil data, tampilkan pesan error di area grid
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

//fungsi buat nampilin daftar lagu ke dalam bentuk card HTML
function renderSongs(songs) {
    const songGrid = document.getElementById('songGrid');
    if (!songGrid) return;

    //kalau hasil filter atau data lagunya kosong, tampilkan pesan kosong
    if (songs.length === 0) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
                <i class="ph ph-music-notes-simple" style="font-size: 3rem;"></i>
                <p style="margin-top: 10px;">Belum ada lagu yang sesuai.</p>
            </div>
        `;
        return;
    }

    //kosongin isi grid sebelum diisi ulang
    songGrid.innerHTML = '';

    //loop tiap lagu buat bikin elemen card satu per satu
    songs.forEach(song => {
        //siapin data id, judul, penyanyi, dan nada dasar lagu
        const songId = song.id_lagu || song.id;
        const songTitle = song.judul_lagu || song.judul || 'Tanpa Judul';
        const songArtist = song.pengarang || song.penyanyi || 'Unknown Artist';
        const key = (song.nada_dasar || '').trim() || '-';

        //bikin elemen pembungkus card lagu
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-category', song.kategori || 'Worship');
        card.style.cursor = 'pointer';

        //arahin ke halaman detail lagu saat card diklik
        card.addEventListener('click', () => {
            window.location.href = `/detail-lagu?id=${songId}`;
        });

        //susun tampilan bagian atas (ikon & nada dasar) dan bawah (judul, penyanyi, tombol hapus)
        card.innerHTML = `
            <div class="top-section">
                <div class="card-icon">
                    <i class="ph-fill ph-music-note"></i>
                </div>
                <div class="card-key">${key}</div>
            </div>
            <div class="bottom-section">
                <div class="card-details">
                    <h3 class="song-title"></h3>
                    <p class="song-artist"></p>
                </div>
                <!--tombol hapus cuma dimunculin kalau user punya hak akses-->
                ${canManageLagu ? `
                <button class="btn-delete" title="Hapus Lagu">
                    <i class="ph-bold ph-trash"></i>
                </button>
                ` : ''}
            </div>
        `;

        //isi teks judul dan penyanyi pakai textContent supaya aman
        card.querySelector('.song-title').textContent = songTitle;
        card.querySelector('.song-artist').textContent = songArtist;

        //pasang aksi klik buat tombol hapus di pojok kanan bawah card
        const btnDelete = card.querySelector('.btn-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', (e) => {
                //cegah klik tombol hapus ikut memicu klik card ke halaman detail
                e.stopPropagation();
                confirmDelete(songId, songTitle);
            });
        }

        //masukin card yang udah jadi ke dalam grid
        songGrid.appendChild(card);
    });
}

//fungsi buat nyaring lagu berdasarkan kata kunci pencarian dan kategori
function filterSongs() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    //ambil teks pencarian dalam huruf kecil dan nilai kategori yang dipilih
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedCategory = filterCategory ? filterCategory.value : 'all';

    //saring array allSongs yang cocok sama kata kunci dan kategori
    const filtered = allSongs.filter(song => {
        const title = (song.judul_lagu || song.judul || '').toLowerCase();
        const artist = (song.pengarang || song.penyanyi || '').toLowerCase();
        const category = song.kategori || 'Worship';

        //cek kecocokan judul/penyanyi serta kategori lagu
        const matchesSearch = title.includes(searchTerm) || artist.includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    //tampilkan hasil lagu yang sudah disaring
    renderSongs(filtered);
}

//fungsi buat konfirmasi dan hapus lagu dari database
async function confirmDelete(id, judul) {
    //minta konfirmasi user dulu sebelum benar-benar menghapus
    if (!confirm(`Apakah Anda yakin ingin menghapus lagu "${judul}"?`)) return;

    try {
        //kirim request DELETE ke backend berdasarkan ID lagu
        const res = await fetch(`/api/lagu/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus lagu');

        //muat ulang daftar lagu setelah berhasil dihapus
        await fetchSongs();
    } catch (err) {
        alert('Gagal menghapus lagu: ' + err.message);
    }
}
