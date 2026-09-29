// public/js/detail-jadwal.js
// ==============================================================================================
// FILE LOGIKA UNTUK HALAMAN DETAIL JADWAL PELAYANAN
// File ini bertugas menampilkan rincian jadwal, daftar tim pelayan, setlist lagu ibadah, 
// fitur penambahan & penghapusan lagu, serta formulir pengajuan izin berhalangan hadir.
// ==============================================================================================

// Menunggu hingga seluruh struktur halaman web (DOM) selesai dimuat oleh browser
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. TUNGGU PROSES AUTENTIKASI ---
    // Pastikan proses pengecekan login (auth Supabase) di background sudah benar-benar selesai
    if (window.authReady) {
        await window.authReady;
    }

    // --- 2. AMBIL ID JADWAL DARI URL ---
    // Membaca parameter yang ada di URL address bar browser (contoh: /detail-jadwal.html?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    // Ambil nilai dari parameter 'id'
    const jadwalId = urlParams.get('id');

    // Jika pengguna membuka halaman ini tanpa membawa ID jadwal, kembalikan ke halaman utama jadwal
    if (!jadwalId) {
        alert("ID Jadwal tidak ditemukan!");
        window.location.href = '/jadwal';
        return; // Hentikan eksekusi kode selanjutnya
    }

    // --- 3. PERIKSA HAK AKSES PENGGUNA (ROLE) ---
    // Cari tahu role user yang sedang aktif (admin, worship planner, worship leader, atau jemaat biasa)
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    
    // Tentukan apakah user boleh mengelola setlist lagu (tambah/hapus lagu):
    // Hanya Super Admin, Admin, Worship Planner, dan Worship Leader yang diperbolehkan
    const canManageLaguJadwal = window.isSuperAdmin || role === 'admin' || role === 'worship planner' || role === 'worship leader';
    
    // Jika user bukan salah satu dari role di atas, sembunyikan semua tombol kelola khusus admin
    if (!canManageLaguJadwal) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    // --- 4. VARIABEL PENYIMPAN DATA (STATE) ---
    // Menyimpan objek data jadwal yang sedang dibuka saat ini
    let currentJadwal = null;
    
    // Menyimpan daftar seluruh lagu yang ada di database (digunakan untuk pilihan saat mau tambah lagu)
    let allSongs = [];
    
    // Menyimpan instans plugin Choices.js (fitur pencarian dalam dropdown lagu)
    let choicesInstance = null;

    // --- 5. TANGKAP ELEMEN-ELEMEN TAMPILAN (DOM) ---
    // Elemen layar pemuatan (loading spinner) dan pembungkus konten utama
    const loadingIndicator = document.getElementById('loading-indicator');
    const detailContent = document.getElementById('detail-content');

    // Elemen teks rincian jadwal di kolom kiri
    const detailTanggal = document.getElementById('detail-tanggal');
    const detailJudul = document.getElementById('detail-judul');
    const detailTujuan = document.getElementById('detail-tujuan');
    const detailPengkotbah = document.getElementById('detail-pengkotbah');
    const timListContainer = document.getElementById('tim-list-container');
    const laguListContainer = document.getElementById('lagu-list-container');
    
    // Elemen formulir penambahan lagu di kolom kanan
    const btnTambahLagu = document.getElementById('btn-tambah-lagu');
    const formTambahLagu = document.getElementById('form-tambah-lagu');
    const selectLagu = document.getElementById('select-lagu');
    const selectKey = document.getElementById('select-key');
    const btnSubmitLagu = document.getElementById('btn-submit-lagu');
    const btnCancelLagu = document.getElementById('btn-cancel-lagu');

    // ==============================================================================================
    // FUNGSI UTAMA: MEMUAT SELURUH DATA DARI SERVER
    // ==============================================================================================
    /**
     * Mengambil detail jadwal dan daftar master lagu dari database server
     */
    async function loadData() {
        try {
            // Langkah A: Ambil data detail jadwal yang dipilih berdasarkan ID-nya
            const resJadwal = await fetch(`/api/jadwal/${jadwalId}`);
            const dataJadwal = await resJadwal.json();
            
            // Jika jadwal tidak ditemukan atau terjadi kegagalan di server
            if (!dataJadwal.success || !dataJadwal.data) {
                alert("Gagal memuat jadwal!");
                window.location.href = '/jadwal';
                return;
            }
            
            // Simpan data jadwal yang didapat ke variabel currentJadwal
            currentJadwal = dataJadwal.data;

            // Langkah B: Jika user berhak mengelola lagu, ambil seluruh data lagu dari bank lagu
            if (canManageLaguJadwal) {
                const resLagu = await fetch('/api/lagu');
                const dataLagu = await resLagu.json();
                
                // Jika data lagu berhasil diambil, simpan dan inisialisasi dropdown pencarian lagu
                if (dataLagu.success) {
                    allSongs = dataLagu.data;
                    initChoices(); // Aktifkan fitur dropdown pencarian lagu
                }
            }

            // Langkah C: Gambar data informasi jadwal dan tim pelayanan ke kolom kiri
            renderDetail();
            
            // Langkah D: Gambar daftar setlist lagu yang sudah dipilih ke kolom kanan
            renderDaftarLagu();

            // Sembunyikan lingkaran pemuatan (loading) dan tampilkan konten utama halaman
            loadingIndicator.style.display = 'none';
            detailContent.style.display = 'grid';

        } catch (error) {
            // Tangani bila ada error koneksi atau kegagalan script
            console.error("Error loading data:", error);
            alert("Terjadi kesalahan saat memuat data.");
        }
    }

    // ==============================================================================================
    // FUNGSI INISIALISASI DROPDOWN PENCARIAN LAGU (CHOICES.JS)
    // ==============================================================================================
    /**
     * Memasang fitur ketik & cari lagu pada dropdown formulir tambah lagu
     */
    function initChoices() {
        // Susun pilihan lagu dengan menyertakan judul, penyanyi, dan nada dasar aslinya
        const options = allSongs.map(lagu => ({
            value: lagu.id,
            label: `${lagu.judul} - ${lagu.penyanyi || 'Tanpa Penyanyi'} (Key Asli: ${lagu.nada_dasar})`
        }));
        
        // Bersihkan isi HTML dropdown sebelumnya agar tidak terjadi duplikasi opsi
        selectLagu.innerHTML = '';
        
        // Inisialisasi library Choices.js pada dropdown lagu
        choicesInstance = new Choices(selectLagu, {
            searchEnabled: true, // Izinkan user mengetik kata kunci pencarian lagu
            itemSelectText: '',  // Hilangkan teks bawaan "Press to select"
            shouldSort: false,    // Pertahankan urutan data dari server
            choices: [
                { value: '', label: 'Cari Nama Lagu', placeholder: true }, // Opsi placeholder awal
                ...options
            ]
        });

        // Ketika user memilih salah satu lagu dari hasil pencarian
        selectLagu.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            // Cari data lagu yang dipilih dari daftar lagu
            const lagu = allSongs.find(l => l.id === selectedId);
            
            // Jika lagunya punya data nada dasar asli, otomatis pasang nada dasar itu di dropdown Key!
            if (lagu && lagu.nada_dasar) {
                selectKey.value = lagu.nada_dasar;
            }
        });
    }

    // ==============================================================================================
    // FUNGSI MERENDER INFORMASI JADWAL & TIM PELAYANAN (KOLOM KIRI)
    // ==============================================================================================
    /**
     * Menampilkan tanggal, judul firman, tujuan, pengkotbah, dan petugas pelayanan
     */
    function renderDetail() {
        // Konversi string tanggal jadwal menjadi objek Date
        const tgl = new Date(currentJadwal.tanggal || currentJadwal.tanggal_pelayanan);
        // Format tanggal lengkap dalam bahasa Indonesia (contoh: "Minggu, 7 Juni 2026")
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        detailTanggal.textContent = tgl.toLocaleDateString('id-ID', options);
        
        // Tampilkan judul/tema ibadah
        detailJudul.textContent = currentJadwal.judul || currentJadwal.tema_pelayanan;
        // Tampilkan tujuan firman atau berikan strip jika kosong
        detailTujuan.textContent = currentJadwal.tujuan || '-';
        // Tampilkan nama pengkotbah atau berikan strip jika kosong
        detailPengkotbah.textContent = currentJadwal.pengkotbah || '-';

        // --- BAGIAN TIM PELAYANAN ---
        // Ambil objek data tim pelayanan dari database
        const tim = currentJadwal.tim_pelayanan || {};
        
        // Urutan posisi pelayanan yang ingin ditampilkan di kartu
        const timOrder = [
            { key: 'worship_leader', label: 'Worship Leader' },
            { key: 'singer', label: 'Singer' },
            { key: 'pianis', label: 'Pianis' },
            { key: 'bassist', label: 'Bassist' },
            { key: 'gitaris', label: 'Gitaris' },
            { key: 'drummer', label: 'Drummer' },
            { key: 'mcm', label: 'MCM' },
            { key: 'lighting', label: 'Lighting' },
            { key: 'soundman', label: 'Soundman' },
            { key: 'usher', label: 'Usher' }
        ];

        // Kosongkan wadah daftar tim sebelum diisi ulang
        timListContainer.innerHTML = '';
        
        // Telusuri setiap peran pelayanan satu per satu
        timOrder.forEach(t => {
            let val = tim[t.key] || '-';
            
            // Penanganan kompatibilitas jika ada data lama yang memisahkan singer 1 & singer 2
            if (t.key === 'singer' && (tim.singer_1 || tim.singer_2)) {
                val = [tim.singer_1, tim.singer_2].filter(Boolean).join(', ');
            }
            // Penanganan kompatibilitas jika ada data lama yang memisahkan usher 1 & usher 2
            if (t.key === 'usher' && (tim.usher_1 || tim.usher_2)) {
                val = [tim.usher_1, tim.usher_2].filter(Boolean).join(', ');
            }
            // Penanganan perbedaan penulisan pianis vs pianist
            if (t.key === 'pianis' && tim.pianist) val = tim.pianist;

            // Buat baris HTML untuk menampilkan label posisi dan nama orang yang bertugas
            const row = document.createElement('div');
            row.className = 'tim-row';
            row.innerHTML = `<div class="tim-label">${t.label}</div><div class="tim-value">${val}</div>`;
            timListContainer.appendChild(row);
        });

        // --- BAGIAN LAPORAN BERHALANGAN ---
        // Periksa nama pengguna yang sedang login saat ini
        const userName = window.userData ? window.userData.nama_lengkap : (window.isSuperAdmin ? 'Super Admin' : '');
        const berhalanganSection = document.getElementById('berhalangan-section');
        
        // Jika ada user yang login, tampilkan kotak formulir izin berhalangan hadir
        if (userName && berhalanganSection) {
            berhalanganSection.style.display = 'block';
        }
    }

    // ==============================================================================================
    // FUNGSI MERENDER DAFTAR LAGU / SETLIST (KOLOM KANAN)
    // ==============================================================================================
    /**
     * Menampilkan kotak lagu-lagu yang akan dibawakan dalam ibadah ini
     */
    function renderDaftarLagu() {
        // Kosongkan isi wadah daftar lagu
        laguListContainer.innerHTML = '';
        // Ambil array lagu yang tersimpan di jadwal ini (jika belum ada, gunakan array kosong)
        const daftarLagu = currentJadwal.daftar_lagu || [];

        // Jika belum ada lagu yang dimasukkan ke jadwal ini
        if (daftarLagu.length === 0) {
            laguListContainer.innerHTML = '<div class="empty-lagu">Belum ada lagu.</div>';
            return;
        }

        // Loop setiap lagu dalam setlist
        daftarLagu.forEach((lagu, index) => {
            // Buat kotak item lagu
            const item = document.createElement('div');
            item.className = 'lagu-item';
            item.style.cursor = 'pointer'; // Beri kursor tangan agar terlihat bisa diklik
            
            // Tombol tempat sampah (hapus lagu) hanya dimunculkan jika user berhak mengelola lagu
            const btnDelete = canManageLaguJadwal ? `<button class="btn-remove-lagu" data-index="${index}"><i class="ph ph-trash"></i></button>` : '';

            // Struktur tampilan item lagu: Nomor urut, Judul lagu, Nada Dasar (Key), dan Tombol Hapus
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap: 12px;">
                    <span style="font-weight:bold; color:#3182ce;">${index + 1}</span>
                    <span class="lagu-title">${lagu.judul}</span>
                </div>
                <div class="lagu-actions">
                    <div class="lagu-key">${lagu.nada_dasar}</div>
                    ${btnDelete}
                </div>
            `;
            
            // Ketika kotak item lagu diklik, arahkan user ke halaman Setlist Latihan (melihat lirik & chord lagu tersebut)
            item.addEventListener('click', (e) => {
                // Jika yang diklik adalah tombol ikon tempat sampah, jangan pindah halaman!
                if (e.target.closest('.btn-remove-lagu')) return;
                
                // Buka halaman detail lagu dengan membawa informasi ID lagu, ID jadwal, dan nomor urut lagunya
                window.location.href = `/detail-lagu.html?id=${lagu.id_lagu}&jadwal_id=${jadwalId}&index=${index}`;
            });
            
            // Masukkan item lagu ke dalam daftar di layar
            laguListContainer.appendChild(item);
        });

        // Pasang aksi klik untuk tombol-tombol hapus lagu (jika user punya hak akses)
        if (canManageLaguJadwal) {
            document.querySelectorAll('.btn-remove-lagu').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    // Ambil nomor urut indeks lagu yang ingin dihapus
                    const idx = e.currentTarget.getAttribute('data-index');
                    // Tampilkan kotak dialog konfirmasi kepada user
                    if (confirm('Hapus lagu ini dari jadwal?')) {
                        await hapusLaguDariJadwal(idx);
                    }
                });
            });
        }
    }

    // ==============================================================================================
    // INTERAKSI FORMULIR TAMBAH LAGU (BUKA / TUTUP FORM)
    // ==============================================================================================
    // Saat tombol "+ Tambah Lagu" diklik:
    if (btnTambahLagu) {
        btnTambahLagu.addEventListener('click', () => {
            formTambahLagu.style.display = 'block'; // Tampilkan formulir tambah lagu
            btnTambahLagu.style.display = 'none';   // Sembunyikan tombol "+ Tambah Lagu"
        });
    }

    // Saat tombol "Batal" pada form tambah lagu diklik:
    if (btnCancelLagu) {
        btnCancelLagu.addEventListener('click', () => {
            formTambahLagu.style.display = 'none';  // Sembunyikan formulir
            btnTambahLagu.style.display = 'block';  // Tampilkan kembali tombol "+ Tambah Lagu"
            // Reset pilihan di dropdown pencarian lagu ke kondisi kosong
            if (choicesInstance) choicesInstance.setChoiceByValue('');
        });
    }

    // ==============================================================================================
    // MEMPROSES PENAMBAHAN LAGU KE DALAM JADWAL
    // ==============================================================================================
    // Saat tombol "Masukkan" pada form tambah lagu diklik:
    if (btnSubmitLagu) {
        btnSubmitLagu.addEventListener('click', async () => {
            // Ambil ID lagu yang dipilih dan Key nada dasar yang ditentukan
            const selectedId = selectLagu.value;
            const selectedKey = selectKey.value;

            // Validasi: pastikan user sudah memilih lagunya terlebih dahulu
            if (!selectedId) {
                alert("Silakan pilih lagu terlebih dahulu.");
                return;
            }

            // Temukan detail lagu tersebut dari bank data lagu
            const laguData = allSongs.find(l => l.id === selectedId);
            if (!laguData) return;

            // Buat objek ringkas lagu baru yang akan disimpan ke jadwal
            const newLaguObj = {
                id_lagu: laguData.id,
                judul: laguData.judul,
                nada_dasar: selectedKey // Nada dasar yang bisa disesuaikan untuk jadwal ini
            };

            // Ambil daftar lagu saat ini dan tambahkan lagu baru ini ke urutan paling akhir
            const daftarLaguSekarang = currentJadwal.daftar_lagu || [];
            daftarLaguSekarang.push(newLaguObj);

            // Berikan efek visual tombol sedang bekerja
            btnSubmitLagu.disabled = true;
            btnSubmitLagu.textContent = 'Menyimpan...';

            try {
                // Kirim pembaruan array daftar_lagu ke server menggunakan metode PUT
                const res = await fetch(`/api/jadwal/${jadwalId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ daftar_lagu: daftarLaguSekarang })
                });

                const data = await res.json();
                
                // Jika server berhasil menyimpan pembaruan
                if (data.success) {
                    // Perbarui data lagu di memori aplikasi
                    currentJadwal.daftar_lagu = daftarLaguSekarang;
                    // Gambar ulang daftar lagu di layar agar lagu yang baru langsung terlihat
                    renderDaftarLagu();
                    // Sembunyikan kembali formulir tambah lagu
                    btnCancelLagu.click();
                } else {
                    alert('Gagal menyimpan lagu ke jadwal.');
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan saat menyimpan.');
            } finally {
                // Kembalikan tombol ke keadaan semula
                btnSubmitLagu.disabled = false;
                btnSubmitLagu.textContent = 'Masukkan';
            }
        });
    }

    // ==============================================================================================
    // FUNGSI MENGHAPUS LAGU DARI JADWAL
    // ==============================================================================================
    /**
     * Menghapus salah satu lagu dari jadwal berdasarkan nomor indeksnya
     * @param {number} index - Posisi urutan lagu dalam array daftar_lagu
     */
    async function hapusLaguDariJadwal(index) {
        // Ambil daftar lagu saat ini
        const daftarLaguSekarang = currentJadwal.daftar_lagu || [];
        // Hapus 1 elemen pada indeks yang dipilih
        daftarLaguSekarang.splice(index, 1);

        try {
            // Kirim daftar lagu yang sudah dikurangi ke backend API via HTTP PUT
            const res = await fetch(`/api/jadwal/${jadwalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daftar_lagu: daftarLaguSekarang })
            });
            const data = await res.json();
            
            // Jika penghapusan berhasil di server
            if (data.success) {
                // Perbarui memori jadwal
                currentJadwal.daftar_lagu = daftarLaguSekarang;
                // Gambar ulang daftar lagu di layar
                renderDaftarLagu();
            }
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus lagu.');
        }
    }

    // ==============================================================================================
    // FITUR LAPORAN BERHALANGAN HADIR
    // ==============================================================================================
    // Tombol "Kirim Laporan" pada kotak Laporan Berhalangan
    const btnSubmitBerhalangan = document.getElementById('btn-submit-berhalangan');
    if (btnSubmitBerhalangan) {
        btnSubmitBerhalangan.addEventListener('click', async () => {
            // Ambil teks alasan yang diketikkan pengguna
            const inputAlasan = document.getElementById('input-alasan-berhalangan');
            const alasan = inputAlasan.value.trim();

            // Validasi: pastikan kolom alasan tidak dibiarkan kosong
            if (!alasan) {
                alert('Silakan tulis alasan berhalangan Anda terlebih dahulu.');
                return;
            }

            // Minta konfirmasi sebelum mengirimkan laporan
            if (!confirm('Kirim laporan berhalangan untuk jadwal ini?')) return;

            // Nonaktifkan tombol sementara dan ubah teksnya agar tidak terklik ganda
            btnSubmitBerhalangan.disabled = true;
            btnSubmitBerhalangan.textContent = 'Mengirim...';

            // Siapkan paket data (payload) yang akan dikirim ke server
            const payload = {
                nama: window.userData ? window.userData.nama_lengkap : 'Super Admin',
                catatan: `Laporan dari ${window.userData ? window.userData.nama_lengkap : 'Super Admin'}`,
                id_jadwal: currentJadwal.id,
                judul_pelayanan: currentJadwal.judul || currentJadwal.tema_pelayanan,
                jadwal_tanggal: new Date(currentJadwal.tanggal || currentJadwal.tanggal_pelayanan).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                alasan: alasan
            };

            try {
                // Kirim data laporan ke endpoint API berhalangan menggunakan metode POST
                const res = await fetch('/api/berhalangan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                
                // Jika pengiriman berhasil
                if (data.success) {
                    alert('Laporan berhalangan berhasil dikirim.');
                    // Kosongkan dan nonaktifkan textarea agar tidak bisa diedit lagi setelah terkirim
                    inputAlasan.value = '';
                    inputAlasan.disabled = true;
                    // Ubah status tombol menjadi 'Terkirim'
                    btnSubmitBerhalangan.textContent = 'Terkirim';
                } else {
                    alert(data.message || 'Gagal mengirim laporan berhalangan.');
                    btnSubmitBerhalangan.disabled = false;
                    btnSubmitBerhalangan.textContent = 'Kirim Laporan';
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan sistem.');
                btnSubmitBerhalangan.disabled = false;
                btnSubmitBerhalangan.textContent = 'Kirim Laporan';
            }
        });
    }

    // --- 6. EKSEKUSI AWAL ---
    // Panggil fungsi loadData() untuk memulai proses pengambilan data dari backend
    loadData();
});
