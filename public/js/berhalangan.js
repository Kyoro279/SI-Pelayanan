//menentukan tab filter yang sedang aktif, pilihannya 'belum' (belum diproses) atau 'semua'.
//sumber data: Nilai variabel ini diubah saat pengguna mengklik tombol tab filter di fungsi initFilterTabs().
let currentFilter = 'belum';

//wadah untuk menyimpan seluruh data permintaan berhalangan yang diambil dari server/database.
//sumber data: Diisi melalui pemanggilan API endpoint '/api/berhalangan' di dalam fungsi loadBerhalanganData().
let berhalanganData = [];

//wadah untuk menyimpan daftar semua akun pengguna (dipakai untuk mengisi opsi nama pelayan pengganti di dropdown).
//sumber data: Diisi melalui pemanggilan API endpoint '/api/akun' di dalam fungsi fetchAkunList().
let akunList = [];

//wadah untuk menyimpan daftar jadwal pelayanan (dipakai untuk pilihan jadwal di modal pengajuan izin baru).
//sumber data: Diisi melalui pemanggilan API endpoint '/api/jadwal' di dalam fungsi fetchJadwalList().
let jadwalList = [];

// ==============================================================================================
// TITIK AWAL: Saat struktur halaman web (DOM) selesai dimuat seluruhnya oleh browser
// ==============================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    //tunggu proses autentikasi login Supabase selesai di latar belakang
    //sumber data: window.authReady adalah Promise yang dibuat di script checkAuth.js
    if (window.authReady) {
        await window.authReady;
    }

    //pasang pendengar aksi klik pada tombol filter (tab belum diproses dan tab semua)
    initFilterTabs();

    //pasang pendengar aksi untuk modal popup formulir pengajuan berhalangan
    initModalEvents();

    //mengambil tiga data sekaligus dari server secara bersamaan agar proses loading lebih cepat
    await Promise.all([
        fetchAkunList(),        //mengambil daftar akun anggota untuk opsi pengganti
        fetchJadwalList(),      //mengambil daftar jadwal ibadah yang ada
        loadBerhalanganData()   //mengambil data permintaan izin berhalangan
    ]);
});

// ==============================================================================================
// 1. FUNGSI MENGAMBIL DATA DARI SERVER (BACKEND API)
// ==============================================================================================

/**
 * Mengambil seluruh data akun anggota dari backend API untuk mengisi pilihan nama pengganti
 */
async function fetchAkunList() {
    try {
        //variabel res menampung balasan HTTP dari server
        //sumber data: mengambil data daftar akun pengguna dari database via HTTP GET ke endpoint '/api/akun'
        const res = await fetch('/api/akun');

        //jika server berhasil merespons dengan sukses (status 200 OK)
        if (res.ok) {
            //variabel akunList mengambil data array akun pengguna hasil konversi JSON menggunakan fungsi res.json()
            akunList = await res.json();
        }
    } catch (err) {
        //menampilkan pesan peringatan di konsol jika gagal mengambil data akun
        console.warn('Gagal memuat data akun untuk pengganti:', err);
    }
}

/**
 * Mengambil data seluruh jadwal pelayanan dari backend API untuk opsi jadwal di formulir modal
 */
async function fetchJadwalList() {
    try {
        //variabel res menampung balasan HTTP dari server
        //sumber data: ambil data jadwal pelayanan dari database via HTTP GET ke endpoint '/api/jadwal'
        const res = await fetch('/api/jadwal');

        //jika server merespons dengan baik
        if (res.ok) {
            //variabel data mengambil objek respons JSON dari server menggunakan fungsi res.json()
            const data = await res.json();
            //variabel jadwalList mengambil array data jadwal dari properti data.data (atau array kosong [] jika data kosong)
            jadwalList = data.data || [];
            //masukkan data jadwal ini ke dalam pilihan dropdown jadwal pada formulir popup modal
            populateJadwalSelect();
        }
    } catch (err) {
        //menampilkan peringatan di konsol jika gagal mengambil data jadwal
        console.warn('Gagal memuat data jadwal:', err);
    }
}

/**
 * Memuat data laporan permohonan berhalangan dari backend API / database
 */
async function loadBerhalanganData() {
    //variabel container mengambil elemen HTML wadah tempat kartu berhalangan ditampilkan menggunakan document.getElementById()
    const container = document.getElementById('berhalangan-container');
    try {
        //variabel res mengirim permintaan HTTP GET ke endpoint API berhalangan '/api/berhalangan' (mengambil data dari database)
        const res = await fetch('/api/berhalangan');
        //jika server mengembalikan status error, lemparkan pesan gagal
        if (!res.ok) throw new Error('Gagal mengambil data permintaan berhalangan');

        //variabel json membaca data jawaban dari server yang diurai dari format JSON menggunakan fungsi res.json()
        const json = await res.json();
        //variabel berhalanganData mengambil data array permohonan berhalangan dari properti json.data
        berhalanganData = json.data || [];
        //gambarkan kartu-kartu laporan berhalangan ke layar menggunakan data dari variabel berhalanganData
        renderList();
    } catch (err) {
        //jika terjadi error saat mengambil data, catat di konsol dan tampilkan pesan di layar
        console.error('Error loadBerhalanganData:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-warning-circle"></i>
                <h3>Terjadi Kesalahan</h3>
                <p>${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

// ==============================================================================================
// 2. FUNGSI MERENDER DAFTAR KARTU LAPORAN BERHALANGAN
// ==============================================================================================

/**
 * Menampilkan kartu-kartu laporan berhalangan sesuai dengan tab filter yang aktif
 */
function renderList() {
    //variabel container mengambil elemen wadah tempat kartu berhalangan ditampilkan
    const container = document.getElementById('berhalangan-container');
    //jika elemen kontainer tidak ditemukan di HTML, hentikan fungsi
    if (!container) return;

    //variabel filtered mengambil data acuan awal dari variabel global berhalanganData (yang didapat dari database)
    let filtered = berhalanganData;

    //jika tab 'belum' yang dipilih, saring hanya data yang statusnya belum selesai diproses
    if (currentFilter === 'belum') {
        //variabel filtered mengambil hasil penyaringan dari berhalanganData menggunakan fungsi bawaan .filter()
        filtered = berhalanganData.filter(item =>
            !item.status || item.status.toLowerCase() === 'belum diproses'
        );
    }

    //jika tidak ada data sama sekali setelah disaring
    if (filtered.length === 0) {
        //variabel emptyMsg menentukan kalimat pesan kosong sesuai nilai variabel currentFilter yang sedang dibuka
        const emptyMsg = currentFilter === 'belum'
            ? 'Tidak ada permintaan berhalangan yang belum diproses.'
            : 'Belum ada riwayat permintaan berhalangan.';

        //menampilkan tampilan status bersih dan kosong yang rapi
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-check-circle"></i>
                <h3>Semua Bersih!</h3>
                <p>${emptyMsg}</p>
            </div>
        `;
        return;
    }

    //membuat elemen HTML untuk setiap data laporan di variabel filtered menggunakan fungsi createCardHTML() lalu digabungkan dengan .join('')
    container.innerHTML = filtered.map(item => createCardHTML(item)).join('');

    //memasang fungsi klik untuk tombol selesai, tombol tolak, dan pilihan pengganti di setiap kartu
    attachCardListeners();
}

// ==============================================================================================
// 3. FUNGSI MEMBUAT ELEMEN HTML SATU KARTU LAPORAN BERHALANGAN
// ==============================================================================================

/**
 * Membuat kerangka string HTML untuk satu buah kartu laporan berhalangan
 * @param {Object} item - Objek satu baris data laporan berhalangan yang diambil dari database
 * @returns {string} - String markup HTML kartu siap tempel ke DOM
 */
function createCardHTML(item) {
    //variabel status mengambil status laporan dari properti item.status (data database, default: 'Belum Diproses')
    const status = item.status || 'Belum Diproses';
    //variabel pengecekan status (boolean true/false) menggunakan fungsi toLowerCase()
    const isBelum = status.toLowerCase() === 'belum diproses';
    const isSelesai = status.toLowerCase() === 'selesai';
    const isDitolak = status.toLowerCase() === 'ditolak';

    //menyiapkan badge penanda status (hanya ditampilkan saat user membuka tab filter "semua")
    let statusBadgeHTML = '';
    if (currentFilter === 'semua') {
        let badgeClass = 'belum'; //kelas CSS warna bawaan
        if (isSelesai) badgeClass = 'selesai'; //warna hijau jika selesai
        if (isDitolak) badgeClass = 'ditolak'; //warna merah jika ditolak
        statusBadgeHTML = `<span class="status-badge ${badgeClass}">${escapeHtml(status)}</span>`;
    }

    //variabel nama mengambil data nama pelayan dari properti item.nama di database dan dibersihkan dari skrip jahat
    const nama = escapeHtml(item.nama || 'Pelayan');
    //variabel firstName mengambil kata panggilan depan pelayan menggunakan fungsi string .split(' ')[0]
    const firstName = nama.split(' ')[0];
    //variabel catatan mengambil data catatan dari properti item.catatan di database (atau membuat teks otomatis memakai variabel firstName)
    const catatan = escapeHtml(item.catatan || `Catatan ${firstName}`);

    //variabel-variabel yang mengambil data jadwal pelayanan terkait dari kolom database:
    //- judulPelayanan mengambil dari properti item.judul_pelayanan
    //- jadwalTanggal mengambil dari properti item.jadwal_tanggal
    //- jadwalId mengambil dari properti item.id_jadwal
    const judulPelayanan = escapeHtml(item.judul_pelayanan || 'Pelayanan');
    const jadwalTanggal = escapeHtml(item.jadwal_tanggal || '-');
    const jadwalId = item.id_jadwal || '';

    //wadah penampung elemen baris aksi tombol atau kotak informasi penyelesaian di bawah kartu
    let actionRowHTML = '';

    //jika status laporan masih "belum diproses"
    if (isBelum) {
        //buat opsi pertama berupa placeholder petunjuk
        let optionsHTML = `<option value="" disabled selected>Nama Pengganti</option>`;

        //jika data daftar akun anggota di variabel akunList tersedia (sudah dimuat dari database)
        if (akunList && akunList.length > 0) {
            //telusuri setiap objek akun pada variabel akunList
            akunList.forEach(akun => {
                //jangan tampilkan nama orang yang berhalangan sebagai pilihan pengganti dirinya sendiri
                //ambil properti akun.nama_lengkap dan akun.role dari objek akun
                if (akun.nama_lengkap !== item.nama) {
                    optionsHTML += `<option value="${escapeHtml(akun.nama_lengkap)}">${escapeHtml(akun.nama_lengkap)} (${escapeHtml(akun.role)})</option>`;
                }
            });
        } else {
            //opsi cadangan jika data akun di database sedang kosong atau gagal termuat
            optionsHTML += `
                <option value="Cloud">Cloud (Worship Leader)</option>
                <option value="metiu">metiu (Pianist / Admin)</option>
                <option value="Jonathan">Jonathan (Singer)</option>
            `;
        }

        //tampilkan dropdown pilihan pengganti beserta tombol "tandai selesai" dan tombol "tolak"
        //atribut data-id pada tombol diisi dari properti item.id database agar tombol tahu data mana yang diproses
        actionRowHTML = `
            <div class="card-action-row">
                <div class="select-pengganti-wrap">
                    <select class="select-pengganti" id="select-pengganti-${item.id}">
                        ${optionsHTML}
                    </select>
                </div>
                <button type="button" class="btn-tandai-selesai" data-id="${item.id}">
                    Tandai Selesai
                </button>
                <button type="button" class="btn-tolak" data-id="${item.id}">
                    Tolak
                </button>
            </div>
        `;
    }
    //jika status sudah selesai diproses (sudah dicarikan pelayan pengganti)
    else if (isSelesai) {
        //tampilkan kotak informasi hijau yang mencantumkan nama pengganti yang diambil dari properti item.nama_pengganti di database
        actionRowHTML = `
            <div class="status-resolved-box selesai">
                <div>
                    <i class="ph ph-check-circle" style="vertical-align: middle; margin-right: 4px;"></i>
                    Selesai &bull; Pengganti: <strong>${escapeHtml(item.nama_pengganti || 'Tidak Ditentukan')}</strong>
                </div>
            </div>
        `;
    }
    //jika permohonan berhalangan ditolak
    else if (isDitolak) {
        //tampilkan kotak informasi merah yang menyatakan permintaan ditolak
        actionRowHTML = `
            <div class="status-resolved-box ditolak">
                <div>
                    <i class="ph ph-x-circle" style="vertical-align: middle; margin-right: 4px;"></i>
                    Permintaan ini Ditolak
                </div>
            </div>
        `;
    }

    //susun seluruh komponen menjadi satu kesatuan elemen kartu artikel HTML
    return `
        <article class="berhalangan-card" id="card-${item.id}">
            <div class="card-top-row">
                <div class="user-identity">
                    <span class="user-name">${nama}</span>
                    <span class="catatan-badge">${catatan}</span>
                </div>
                ${statusBadgeHTML}
            </div>

            <p class="pelayanan-subtitle">
                Pelayanan: 
                <a href="${jadwalId ? `/detail-jadwal.html?id=${jadwalId}` : '/jadwal'}" class="pelayanan-link" title="Buka Detail Jadwal">
                    ${judulPelayanan} . ${jadwalTanggal}
                </a>
            </p>

            <div class="alasan-box">
                <div class="alasan-label">ALASAN</div>
                <div class="alasan-content">${escapeHtml(item.alasan || '-')}</div>
            </div>

            ${actionRowHTML}
        </article>
    `;
}

// ==============================================================================================
// 4. FUNGSI PENANGAN AKSI TOMBOL KARTU (TANDAI SELESAI & TOLAK)
// ==============================================================================================

/**
 * Memasang pendengar aksi klik pada tombol "Tandai Selesai" dan tombol "Tolak" di setiap kartu
 */
function attachCardListeners() {
    //variabel btnSelesaiList mengambil seluruh elemen tombol "Tandai Selesai" menggunakan document.querySelectorAll()
    const btnSelesaiList = document.querySelectorAll('.btn-tandai-selesai');
    btnSelesaiList.forEach(btn => {
        //ketika tombol "Tandai Selesai" diklik
        btn.addEventListener('click', async (e) => {
            //variabel id mengambil data ID laporan berhalangan dari atribut HTML 'data-id' tombol menggunakan e.currentTarget.getAttribute()
            const id = e.currentTarget.getAttribute('data-id');
            //variabel selectElem mengambil elemen dropdown pilihan nama pengganti berdasarkan ID dropdown select-pengganti-${id}
            const selectElem = document.getElementById(`select-pengganti-${id}`);
            //variabel selectedPengganti mengambil nilai teks nama pengganti yang dipilih dari properti selectElem.value
            const selectedPengganti = selectElem ? selectElem.value : '';

            //jika user/admin belum memilih nama pengganti dari dropdown
            if (!selectedPengganti) {
                //tampilkan konfirmasi apakah ingin tetap menyelesaikan tanpa menentukan pengganti
                const proceedWithout = confirm('Anda belum memilih Nama Pengganti. Apakah ingin tetap menandai selesai tanpa pengganti?');
                //jika dibatalkan, arahkan fokus ke dropdown dan hentikan proses
                if (!proceedWithout) {
                    if (selectElem) selectElem.focus();
                    return;
                }
            }

            //nonaktifkan tombol dan ubah tampilannya menjadi animasi loading
            btn.disabled = true;
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Menyimpan...`;

            try {
                //variabel res mengirim permintaan HTTP PUT ke backend API di endpoint `/api/berhalangan/${id}/selesai`
                //data nama pengganti dikirim dalam bentuk body JSON yang diambil dari variabel selectedPengganti
                const res = await fetch(`/api/berhalangan/${id}/selesai`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nama_pengganti: selectedPengganti })
                });

                //jika server gagal memproses, lemparkan pesan error
                if (!res.ok) throw new Error('Gagal memperbarui status');
                //variabel result membaca hasil respons dari server menggunakan res.json()
                const result = await res.json();

                //variabel targetIndex mencari posisi indeks data laporan ini di array berhalanganData menggunakan fungsi bawaan .findIndex() berdasarkan kecocokan ID
                const targetIndex = berhalanganData.findIndex(item => item.id == id);
                if (targetIndex !== -1) {
                    //perbarui status menjadi 'selesai' dan simpan nilai nama pengganti dari variabel selectedPengganti ke array lokal
                    berhalanganData[targetIndex].status = 'Selesai';
                    berhalanganData[targetIndex].nama_pengganti = selectedPengganti;
                }

                //tampilkan notifikasi pemberitahuan toast sukses di sudut layar
                showToast(`Permintaan berhasil diselesaikan!${selectedPengganti ? ' Pengganti: ' + selectedPengganti : ''}`, 'success');
                //gambar ulang daftar kartu agar kartu yang selesai berpindah sesuai tab filter
                renderList();
            } catch (err) {
                //jika terjadi error saat menyimpan data
                console.error(err);
                //tampilkan pesan error dalam toast merah
                showToast(err.message, 'error');
                //kembalikan tombol agar bisa ditekan kembali
                btn.disabled = false;
                btn.textContent = 'Tandai Selesai';
            }
        });
    });

    //variabel btnTolakList mengambil seluruh elemen tombol "Tolak" menggunakan document.querySelectorAll()
    const btnTolakList = document.querySelectorAll('.btn-tolak');
    btnTolakList.forEach(btn => {
        //ketika tombol "Tolak" diklik
        btn.addEventListener('click', async (e) => {
            //variabel id mengambil data ID laporan berhalangan dari atribut HTML 'data-id' tombol
            const id = e.currentTarget.getAttribute('data-id');
            //tampilkan kotak konfirmasi kepada pengguna sebelum menolak
            const confirmTolak = confirm('Apakah Anda yakin ingin menolak permintaan berhalangan ini?');
            //jika pengguna memilih batal (Cancel), hentikan proses
            if (!confirmTolak) return;

            //nonaktifkan tombol dan ubah teksnya menjadi animasi loading
            btn.disabled = true;
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Menolak...`;

            try {
                //variabel res mengirim permintaan HTTP PUT ke backend API di endpoint `/api/berhalangan/${id}/tolak` untuk mengubah status di database
                const res = await fetch(`/api/berhalangan/${id}/tolak`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                });

                //jika server gagal memproses permintaan, lemparkan error
                if (!res.ok) throw new Error('Gagal menolak permintaan');
                //variabel result membaca jawaban server dari format JSON
                const result = await res.json();

                //variabel targetIndex mencari indeks laporan di array berhalanganData berdasarkan kecocokan ID menggunakan fungsi .findIndex()
                const targetIndex = berhalanganData.findIndex(item => item.id == id);
                if (targetIndex !== -1) {
                    //perbarui status menjadi 'ditolak' di dalam memori
                    berhalanganData[targetIndex].status = 'Ditolak';
                }

                //tampilkan notifikasi toast bahwa permintaan telah ditolak
                showToast('Permintaan berhalangan telah ditolak.', 'success');
                //gambar ulang daftar kartu
                renderList();
            } catch (err) {
                //jika terjadi kesalahan pada jaringan atau server
                console.error(err);
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Tolak';
            }
        });
    });
}

// ==============================================================================================
// 5. FUNGSI FILTER TAB (BELUM DIPROSES & SEMUA)
// ==============================================================================================

/**
 * Memasang aksi pada tombol tab penyaring ("Belum Diproses" dan "Semua")
 */
function initFilterTabs() {
    //variabel btnBelum dan btnSemua mengambil elemen tombol tab menggunakan document.getElementById()
    const btnBelum = document.getElementById('btn-filter-belum');
    const btnSemua = document.getElementById('btn-filter-semua');

    if (btnBelum && btnSemua) {
        //saat tombol tab "Belum Diproses" diklik
        btnBelum.addEventListener('click', () => {
            //ubah variabel filter aktif menjadi 'belum'
            currentFilter = 'belum';
            //tandai tombol ini sebagai aktif dan matikan status aktif di tombol lainnya
            btnBelum.classList.add('active');
            btnSemua.classList.remove('active');
            //tampilkan ulang daftar kartu sesuai filter baru
            renderList();
        });

        //saat tombol tab "Semua" diklik
        btnSemua.addEventListener('click', () => {
            //ubah variabel filter aktif menjadi 'semua'
            currentFilter = 'semua';
            //tandai tombol ini sebagai aktif dan matikan status aktif di tombol sebelumnya
            btnSemua.classList.add('active');
            btnBelum.classList.remove('active');
            //tampilkan ulang seluruh riwayat kartu
            renderList();
        });
    }
}

// ==============================================================================================
// 6. FUNGSI PENGATURAN pop-up FORMULIR AJUKAN BERHALANGAN
// ==============================================================================================

/**
 * Mengelola buka-tutup dan pengiriman data formulir popup pop-up ajukan berhalangan
 */
function initModalEvents() {
    //variabel-variabel penampung elemen pop-up yang diambil dari DOM menggunakan document.getElementById()
    const modal = document.getElementById('modal-ajukan');
    const btnOpen = document.getElementById('btn-open-modal-ajukan');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCancel = document.getElementById('btn-cancel-modal');
    const form = document.getElementById('form-ajukan-berhalangan');

    //jika pop-up tidak ada di halaman ini, hentikan fungsi
    if (!modal) return;

    //fungsi bantuan untuk membuka tampilan pop-up ke layar
    const openModal = () => {
        modal.style.display = 'flex';
        //jika pengguna sedang login, otomatis isikan nama lengkapnya ke kolom nama
        //ambil data nama lengkap dari variabel global window.userData.nama_lengkap (disediakan oleh checkAuth.js dari sesi Supabase)
        if (window.userData && window.userData.nama_lengkap) {
            const inputNama = document.getElementById('input-nama-pelayan');
            if (inputNama && !inputNama.value) {
                inputNama.value = window.userData.nama_lengkap;
            }
        }
    };

    //fungsi bantuan untuk menutup tampilan pop-up dan mereset form
    const closeModal = () => {
        modal.style.display = 'none';
        if (form) form.reset();
    };

    //pasang event klik pada tombol buka pop-up ("Ajukan")
    if (btnOpen) btnOpen.addEventListener('click', openModal);
    //pasang event klik pada tombol silang (X) penutup pop-up
    if (btnClose) btnClose.addEventListener('click', closeModal);
    //pasang event klik pada tombol "Batal" di dalam pop-up
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    //tutup pop-up jika pengguna mengklik area luar yang gelap (latar belakang pop-up)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    //ketika formulir di dalam pop-up di-submit oleh pengguna
    if (form) {
        form.addEventListener('submit', async (e) => {
            //mencegah perilaku bawaan browser agar halaman tidak refresh sendiri
            e.preventDefault();

            //mengambil data dari elemen formulir HTML
            //variabel btnSubmit mengambil tombol submit di pop-up
            const btnSubmit = document.getElementById('btn-submit-ajukan');
            //variabel nama mengambil teks nama pelayan yang diketik dari input 'input-nama-pelayan' dan dibersihkan spasinya dengan .trim()
            const nama = document.getElementById('input-nama-pelayan').value.trim();
            //variabel alasan mengambil teks alasan berhalangan dari textarea 'input-alasan' dan dibersihkan spasinya dengan .trim()
            const alasan = document.getElementById('input-alasan').value.trim();
            //variabel selectPelayanan mengambil elemen dropdown HTML pilihan jadwal pelayanan
            const selectPelayanan = document.getElementById('select-pelayanan');

            //variabel nilai awal untuk informasi jadwal pelayanan terkait
            let id_jadwal = null;
            let judul_pelayanan = 'Pelayanan Ibadah';
            let jadwal_tanggal = '-';

            //jika pengguna memilih salah satu jadwal pelayanan dari dropdown
            if (selectPelayanan && selectPelayanan.value) {
                //variabel id_jadwal mengambil nilai ID jadwal dari properti selectPelayanan.value
                id_jadwal = selectPelayanan.value;
                //variabel opt mengambil elemen option HTML yang sedang dipilih menggunakan selectPelayanan.selectedOptions[0]
                const opt = selectPelayanan.selectedOptions[0];
                if (opt) {
                    //variabel judul_pelayanan mengambil teks nama judul dari atribut HTML 'data-judul'
                    judul_pelayanan = opt.getAttribute('data-judul') || 'Pelayanan Ibadah';
                    //variabel jadwal_tanggal mengambil teks tanggal dari atribut HTML 'data-tanggal'
                    jadwal_tanggal = opt.getAttribute('data-tanggal') || '-';
                }
            }

            //validasi: pastikan kolom nama dan kolom alasan tidak dibiarkan kosong
            if (!nama || !alasan) {
                alert('Nama dan Alasan wajib diisi!');
                return;
            }

            //nonaktifkan tombol kirim dan berikan efek loading
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Mengirim...`;

            try {
                //variabel res mengirim data laporan berhalangan baru ke server melalui HTTP POST ke endpoint '/api/berhalangan'
                //sumber data: menggabungkan variabel nama, id_jadwal, judul_pelayanan, jadwal_tanggal, dan alasan ke dalam objek JSON
                const res = await fetch('/api/berhalangan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nama,
                        id_jadwal,
                        judul_pelayanan,
                        jadwal_tanggal,
                        alasan
                    })
                });

                //jika pengiriman gagal, lemparkan error
                if (!res.ok) throw new Error('Gagal mengirim permintaan');
                //variabel result membaca hasil jawaban balasan server yang dikonversi dari JSON
                const result = await res.json();

                //jika berhasil, masukkan data laporan baru dari properti result.data ke urutan paling atas array berhalanganData menggunakan fungsi .unshift()
                if (result.data) {
                    berhalanganData.unshift(result.data);
                }

                //tutup jendela pop-up
                closeModal();
                //tampilkan notifikasi toast sukses di layar
                showToast('Permintaan berhalangan berhasil diajukan!', 'success');
                //perbarui daftar kartu di layar agar laporan baru langsung muncul
                renderList();
            } catch (err) {
                //jika terjadi error saat pengiriman
                console.error(err);
                alert('Gagal mengirim: ' + err.message);
            } finally {
                //kembalikan tombol kirim ke status semula setelah proses selesai
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Kirim Permintaan';
            }
        });
    }
}

// ==============================================================================================
// 7. FUNGSI MENGISI DROPDOWN JADWAL PELAYANAN DI MODAL
// ==============================================================================================

/**
 * Mengisi pilihan dropdown jadwal pelayanan pada modal pengajuan
 */
function populateJadwalSelect() {
    //variabel select mengambil elemen dropdown select jadwal pelayanan dari DOM
    const select = document.getElementById('select-pelayanan');
    //jika elemen tidak ada atau data jadwal di variabel jadwalList kosong, hentikan fungsi
    if (!select || !jadwalList) return;

    //kosongkan opsi lama dan berikan opsi pilihan default
    select.innerHTML = '<option value="">Pilih Jadwal Pelayanan...</option>';

    //telusuri setiap objek jadwal ibadah yang ada di variabel jadwalList (dari database)
    jadwalList.forEach(j => {
        //variabel judul mengambil nama tema/acara dari properti j.judul atau j.tema_pelayanan
        const judul = j.judul || j.tema_pelayanan || 'Pelayanan';
        //variabel tgl mengambil tanggal pelaksanaan dari properti j.tanggal atau j.tanggal_pelayanan
        const tgl = j.tanggal || j.tanggal_pelayanan || '-';

        //variabel opt membuat elemen tag <option> baru
        const opt = document.createElement('option');
        //mengisi nilai opsi dengan ID jadwal dari properti j.id atau j.id_jadwal
        opt.value = j.id || j.id_jadwal || '';
        //menyimpan data dari variabel judul dan tgl ke atribut HTML data-judul dan data-tanggal agar mudah diambil kembali saat formulir di-submit
        opt.setAttribute('data-judul', judul);
        opt.setAttribute('data-tanggal', tgl);
        //teks label yang ditampilkan ke pengguna menggabungkan variabel judul dan tgl (contoh: "Ibadah Remaja (2026-06-06)")
        opt.textContent = `${judul} (${tgl})`;

        //masukkan opsi ini ke dalam dropdown select
        select.appendChild(opt);
    });
}

// ==============================================================================================
// 8. FUNGSI UTILITAS & BANTUAN
// ==============================================================================================

/**
 * Memunculkan notifikasi pop-up kecil (toast) yang akan hilang sendiri
 * @param {string} message - Pesan teks yang ingin ditampilkan
 * @param {string} type - Jenis pesan: 'info', 'success', atau 'error'
 */
function showToast(message, type = 'info') {
    //variabel container mengambil elemen wadah toast dari DOM
    const container = document.getElementById('toast-container');
    if (!container) return;

    //variabel toast membuat elemen div kotak notifikasi baru
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    //variabel icon menentukan jenis ikon Phosphor Icons yang sesuai dengan tipe pesan
    let icon = 'ph-info';
    if (type === 'success') icon = 'ph-check-circle';
    if (type === 'error') icon = 'ph-warning';

    //isi kotak toast dengan ikon dan pesan teks yang dibersihkan dengan escapeHtml()
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    //tempelkan kotak toast ke dalam container di pojok layar
    container.appendChild(toast);

    //atur waktu otomatis hilangnya notifikasi setelah 3,5 detik
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        //hapus elemen toast dari DOM setelah animasi selesai
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Mengamankan teks dari karakter berbahaya agar terhindar dari serangan XSS (Cross-Site Scripting)
 * @param {string} str - Teks mentah
 * @returns {string} - Teks aman dengan entitas HTML
 */
function escapeHtml(str) {
    //jika nilai teks kosong atau null, kembalikan string kosong
    if (!str) return '';
    //mengubah karakter khusus HTML menjadi kode entitas aman
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
