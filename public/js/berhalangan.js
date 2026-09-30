//menentukan tab filter yang sedang aktif, pilihannya 'belum' (belum diproses) atau 'semua'
let currentFilter = 'belum';

//wadah untuk menyimpan seluruh data permintaan berhalangan yang diambil dari server
let berhalanganData = [];

//wadah untuk menyimpan daftar semua akun pengguna (dipakai untuk mengisi opsi nama pengganti)
let akunList = [];

//wadah untuk menyimpan daftar jadwal pelayanan (dipakai untuk pilihan jadwal di modal pengajuan)
let jadwalList = [];

//saat struktur halaman web (DOM) selesai dimuat seluruhnya oleh browser
document.addEventListener('DOMContentLoaded', async () => {
    //tunggu proses autentikasi login supabase selesai di latar belakang
    if (window.authReady) {
        await window.authReady;
    }

    //pasang pendengar aksi klik pada tombol filter (tab belum diproses dan tab semua)
    initFilterTabs();

    //pasang pendengar aksi untuk modal popup formulir pengajuan berhalangan
    initModalEvents();

    //ambil tiga data sekaligus dari server secara bersamaan agar proses loading lebih cepat
    await Promise.all([
        fetchAkunList(),        //mengambil daftar akun anggota untuk opsi pengganti
        fetchJadwalList(),      //mengambil daftar jadwal ibadah yang ada
        loadBerhalanganData()   //mengambil data permintaan izin berhalangan
    ]);
});

// ==============================================================================================
// 1. FUNGSI MENGAMBIL DATA DARI SERVER
// ==============================================================================================

//fungsi untuk mengambil seluruh data akun anggota dari backend
async function fetchAkunList() {
    try {
        //mengirim permintaan GET ke endpoint API akun
        const res = await fetch('/api/akun');
        //jika permintaan berhasil, simpan hasilnya dalam variabel akunList
        if (res.ok) {
            akunList = await res.json();
        }
    } catch (err) {
        //menampilkan pesan peringatan di konsol jika gagal mengambil data akun
        console.warn('Gagal memuat data akun untuk pengganti:', err);
    }
}

//fungsi untuk mengambil data seluruh jadwal pelayanan dari backend
async function fetchJadwalList() {
    try {
        //mengirim permintaan GET ke endpoint API jadwal
        const res = await fetch('/api/jadwal');
        //jika server merespons dengan baik
        if (res.ok) {
            const data = await res.json();
            //simpan data array jadwal ke jadwalList, atau gunakan array kosong jika tidak ada
            jadwalList = data.data || [];
            //masukkan data jadwal ini ke dalam pilihan dropdown jadwal pada formulir popup
            populateJadwalSelect();
        }
    } catch (err) {
        //menampilkan peringatan di konsol jika gagal mengambil data jadwal
        console.warn('Gagal memuat data jadwal:', err);
    }
}

//fungsi untuk memuat data laporan berhalangan dari database
async function loadBerhalanganData() {
    //mengambil elemen kontainer pembungkus daftar kartu berhalangan
    const container = document.getElementById('berhalangan-container');
    try {
        //mengirim permintaan GET ke API berhalangan
        const res = await fetch('/api/berhalangan');
        //jika server mengembalikan error, lemparkan pesan gagal
        if (!res.ok) throw new Error('Gagal mengambil data permintaan berhalangan');
        
        //membaca respon JSON dari server
        const json = await res.json();
        //simpan data permintaan berhalangan ke variabel berhalanganData
        berhalanganData = json.data || [];
        //gambarkan kartu-kartu laporan berhalangan ke layar
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

//fungsi untuk menampilkan kartu-kartu laporan berhalangan sesuai dengan tab filter yang aktif
function renderList() {
    //ambil elemen tempat kartu berhalangan ditampilkan
    const container = document.getElementById('berhalangan-container');
    //jika elemen kontainer tidak ditemukan di HTML, hentikan fungsi
    if (!container) return;

    //siapkan data yang akan disaring berdasarkan tab filter aktif
    let filtered = berhalanganData;
    
    //jika tab 'belum' yang dipilih, saring hanya data yang belum selesai diproses
    if (currentFilter === 'belum') {
        filtered = berhalanganData.filter(item => 
            !item.status || item.status.toLowerCase() === 'belum diproses'
        );
    }

    //jika tidak ada data sama sekali setelah disaring
    if (filtered.length === 0) {
        //tentukan kalimat pesan kosong sesuai tab yang sedang dibuka
        const emptyMsg = currentFilter === 'belum' 
            ? 'Tidak ada permintaan berhalangan yang belum diproses.' 
            : 'Belum ada riwayat permintaan berhalangan.';
        
        //tampilkan tampilan status bersih dan kosong yang rapi
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-check-circle"></i>
                <h3>Semua Bersih!</h3>
                <p>${emptyMsg}</p>
            </div>
        `;
        return;
    }

    //membuat elemen HTML untuk setiap data laporan berhalangan dan menggabungkannya
    container.innerHTML = filtered.map(item => createCardHTML(item)).join('');

    //pasang fungsi klik untuk tombol selesai, tombol tolak, dan pilihan pengganti di setiap kartu
    attachCardListeners();
}

//fungsi untuk membuat kerangka HTML dari satu buah kartu laporan berhalangan
function createCardHTML(item) {
    //ambil status laporan atau beri default 'Belum Diproses'
    const status = item.status || 'Belum Diproses';
    //cek apakah statusnya masih menunggu proses
    const isBelum = status.toLowerCase() === 'belum diproses';
    //cek apakah laporan ini sudah selesai dicarikan pengganti
    const isSelesai = status.toLowerCase() === 'selesai';
    //cek apakah permohonan berhalangan ini ditolak
    const isDitolak = status.toLowerCase() === 'ditolak';

    //siapkan badge penanda status (hanya ditampilkan saat berada di tab "Semua")
    let statusBadgeHTML = '';
    if (currentFilter === 'semua') {
        let badgeClass = 'belum'; //kelas CSS warna badge bawaan
        if (isSelesai) badgeClass = 'selesai'; //warna hijau jika selesai
        if (isDitolak) badgeClass = 'ditolak'; //warna merah jika ditolak
        statusBadgeHTML = `<span class="status-badge ${badgeClass}">${escapeHtml(status)}</span>`;
    }

    //mengamankan teks nama pelayan yang berhalangan dari skrip berbahaya
    const nama = escapeHtml(item.nama || 'Pelayan');
    //mengambil nama panggilan depan untuk teks catatan singkat
    const firstName = nama.split(' ')[0];
    //membuat teks label catatan (misal: "Catatan Matthew")
    const catatan = escapeHtml(item.catatan || `Catatan ${firstName}`);

    //mengambil nama jadwal pelayanan yang terkait dan tanggal pelaksanaannya
    const judulPelayanan = escapeHtml(item.judul_pelayanan || 'Pelayanan');
    const jadwalTanggal = escapeHtml(item.jadwal_tanggal || '-');
    const jadwalId = item.id_jadwal || '';

    //wadah untuk baris aksi atau status penyelesaian di bagian bawah kartu
    let actionRowHTML = '';
    
    //KONDISI 1: jika status masih belum diproses
    if (isBelum) {
        //buat opsi pertama berupa placeholder petunjuk
        let optionsHTML = `<option value="" disabled selected>Nama Pengganti</option>`;
        
        //jika daftar akun anggota tersedia
        if (akunList && akunList.length > 0) {
            akunList.forEach(akun => {
                //jangan tampilkan nama orang yang berhalangan sebagai pilihan pengganti dirinya sendiri
                if (akun.nama_lengkap !== item.nama) {
                    optionsHTML += `<option value="${escapeHtml(akun.nama_lengkap)}">${escapeHtml(akun.nama_lengkap)} (${escapeHtml(akun.role)})</option>`;
                }
            });
        } else {
            //opsi cadangan jika data akun kosong
            optionsHTML += `
                <option value="Cloud">Cloud (Worship Leader)</option>
                <option value="metiu">metiu (Pianist / Admin)</option>
                <option value="Jonathan">Jonathan (Singer)</option>
            `;
        }

        //tampilkan dropdown pilihan pengganti beserta tombol "Tandai Selesai" dan tombol "Tolak"
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
    //KONDISI 2: jika status sudah selesai diproses (sudah ada orang penggantinya)
    else if (isSelesai) {
        //tampilkan kotak informasi hijau yang mencantumkan nama orang penggantinya
        actionRowHTML = `
            <div class="status-resolved-box selesai">
                <div>
                    <i class="ph ph-check-circle" style="vertical-align: middle; margin-right: 4px;"></i>
                    Selesai &bull; Pengganti: <strong>${escapeHtml(item.nama_pengganti || 'Tidak Ditentukan')}</strong>
                </div>
            </div>
        `;
    } 
    //KONDISI 3: jika permohonan berhalangan ditolak
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
// 3. FUNGSI PENANGAN AKSI TOMBOL (TANDAI SELESAI & TOLAK)
// ==============================================================================================

//fungsi untuk memasang event listener pada tombol-tombol yang ada di dalam setiap kartu
function attachCardListeners() {
    //ambil seluruh tombol "Tandai Selesai" yang ada di kartu
    const btnSelesaiList = document.querySelectorAll('.btn-tandai-selesai');
    btnSelesaiList.forEach(btn => {
        //ketika tombol "Tandai Selesai" diklik
        btn.addEventListener('click', async (e) => {
            //ambil ID laporan berhalangan dari atribut data-id tombol
            const id = e.currentTarget.getAttribute('data-id');
            //ambil elemen dropdown pengganti yang berada satu kartu dengan tombol ini
            const selectElem = document.getElementById(`select-pengganti-${id}`);
            //baca nama pengganti yang sedang dipilih oleh pengguna
            const selectedPengganti = selectElem ? selectElem.value : '';

            //jika admin belum memilih nama pengganti dari dropdown
            if (!selectedPengganti) {
                //tampilkan konfirmasi apakah ingin tetap menyelesaikan tanpa menentukan pengganti
                const proceedWithout = confirm('Anda belum memilih Nama Pengganti. Apakah ingin tetap menandai selesai tanpa pengganti?');
                //jika admin membatalkan konfirmasi, fokuskan kursor ke dropdown dan hentikan proses
                if (!proceedWithout) {
                    if (selectElem) selectElem.focus();
                    return;
                }
            }

            //nonaktifkan tombol dan ubah tampilannya menjadi animasi loading
            btn.disabled = true;
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Menyimpan...`;

            try {
                //kirim permintaan PUT ke backend untuk mengubah status laporan ini menjadi selesai
                const res = await fetch(`/api/berhalangan/${id}/selesai`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nama_pengganti: selectedPengganti })
                });

                //jika server gagal memproses, lemparkan error
                if (!res.ok) throw new Error('Gagal memperbarui status');
                const result = await res.json();

                //perbarui data secara langsung di array lokal tanpa perlu reload halaman
                const targetIndex = berhalanganData.findIndex(item => item.id == id);
                if (targetIndex !== -1) {
                    berhalanganData[targetIndex].status = 'Selesai';
                    berhalanganData[targetIndex].nama_pengganti = selectedPengganti;
                }

                //tampilkan notifikasi pemberitahuan hijau (toast) di sudut layar
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

    //ambil seluruh tombol "Tolak" yang ada di kartu
    const btnTolakList = document.querySelectorAll('.btn-tolak');
    btnTolakList.forEach(btn => {
        //ketika tombol "Tolak" diklik
        btn.addEventListener('click', async (e) => {
            //ambil ID laporan berhalangan dari atribut tombol
            const id = e.currentTarget.getAttribute('data-id');
            //tampilkan kotak konfirmasi kepada pengguna sebelum menolak
            const confirmTolak = confirm('Apakah Anda yakin ingin menolak permintaan berhalangan ini?');
            //jika pengguna memilih cancel, batalkan proses
            if (!confirmTolak) return;

            //nonaktifkan tombol dan ubah teksnya menjadi animasi loading
            btn.disabled = true;
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Menolak...`;

            try {
                //kirim permintaan PUT ke backend untuk menandai laporan ini ditolak
                const res = await fetch(`/api/berhalangan/${id}/tolak`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                });

                //jika server gagal memproses permintaan, lemparkan error
                if (!res.ok) throw new Error('Gagal menolak permintaan');
                const result = await res.json();

                //perbarui status di array lokal
                const targetIndex = berhalanganData.findIndex(item => item.id == id);
                if (targetIndex !== -1) {
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
// 4. FUNGSI FILTER TAB (BELUM DIPROSES & SEMUA)
// ==============================================================================================

//fungsi untuk memasang aksi pada tombol tab penyaring
function initFilterTabs() {
    //ambil tombol tab "Belum Diproses" dan tab "Semua"
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
// 5. FUNGSI PENGATURAN MODAL FORMULIR AJUKAN BERHALANGAN
// ==============================================================================================

//fungsi untuk mengelola buka-tutup dan pengiriman data formulir popup modal
function initModalEvents() {
    //tangkap seluruh elemen yang terkait dengan modal pengajuan
    const modal = document.getElementById('modal-ajukan');
    const btnOpen = document.getElementById('btn-open-modal-ajukan');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCancel = document.getElementById('btn-cancel-modal');
    const form = document.getElementById('form-ajukan-berhalangan');

    //jika modal tidak ada di halaman ini, hentikan fungsi
    if (!modal) return;

    //fungsi bantuan untuk membuka tampilan modal ke layar
    const openModal = () => {
        modal.style.display = 'flex';
        //jika pengguna sedang login, otomatis isikan nama lengkapnya ke kolom nama
        if (window.userData && window.userData.nama_lengkap) {
            const inputNama = document.getElementById('input-nama-pelayan');
            if (inputNama && !inputNama.value) {
                inputNama.value = window.userData.nama_lengkap;
            }
        }
    };

    //fungsi bantuan untuk menutup tampilan modal dan mereset form
    const closeModal = () => {
        modal.style.display = 'none';
        if (form) form.reset();
    };

    //pasang event klik pada tombol buka modal ("Ajukan")
    if (btnOpen) btnOpen.addEventListener('click', openModal);
    //pasang event klik pada tombol silang (X) penutup modal
    if (btnClose) btnClose.addEventListener('click', closeModal);
    //pasang event klik pada tombol "Batal" di dalam modal
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    //tutup modal jika pengguna mengklik area luar yang gelap (latar belakang modal)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    //ketika formulir di dalam modal di-submit oleh pengguna
    if (form) {
        form.addEventListener('submit', async (e) => {
            //mencegah perilaku bawaan browser agar halaman tidak refresh sendiri
            e.preventDefault();
            
            //ambil elemen tombol kirim dan inputan data formulir
            const btnSubmit = document.getElementById('btn-submit-ajukan');
            const nama = document.getElementById('input-nama-pelayan').value.trim();
            const alasan = document.getElementById('input-alasan').value.trim();
            const selectPelayanan = document.getElementById('select-pelayanan');

            //siapkan nilai awal untuk informasi jadwal pelayanan terkait
            let id_jadwal = null;
            let judul_pelayanan = 'Pelayanan Ibadah';
            let jadwal_tanggal = '-';

            //jika pengguna memilih salah satu jadwal pelayanan dari dropdown
            if (selectPelayanan && selectPelayanan.value) {
                id_jadwal = selectPelayanan.value;
                const opt = selectPelayanan.selectedOptions[0];
                if (opt) {
                    judul_pelayanan = opt.getAttribute('data-judul') || 'Pelayanan Ibadah';
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
                //kirim data laporan berhalangan baru ke server melalui HTTP POST
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
                const result = await res.json();

                //jika berhasil, masukkan data laporan baru ini ke urutan paling atas daftar
                if (result.data) {
                    berhalanganData.unshift(result.data);
                }

                //tutup jendela modal
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

//fungsi untuk mengisi pilihan dropdown jadwal pelayanan pada modal pengajuan
function populateJadwalSelect() {
    //ambil elemen select jadwal pelayanan
    const select = document.getElementById('select-pelayanan');
    //jika elemen tidak ada atau data jadwal kosong, hentikan
    if (!select || !jadwalList) return;

    //kosongkan opsi lama dan berikan opsi pilihan default
    select.innerHTML = '<option value="">Pilih Jadwal Pelayanan...</option>';
    
    //telusuri setiap jadwal ibadah yang ada
    jadwalList.forEach(j => {
        //ambil judul firman/acara dan tanggalnya
        const judul = j.judul || j.tema_pelayanan || 'Pelayanan';
        const tgl = j.tanggal || j.tanggal_pelayanan || '-';
        
        //buat elemen option baru
        const opt = document.createElement('option');
        opt.value = j.id || j.id_jadwal || '';
        //simpan data judul dan tanggal di atribut data elemen agar mudah dibaca nanti
        opt.setAttribute('data-judul', judul);
        opt.setAttribute('data-tanggal', tgl);
        //teks yang ditampilkan ke pengguna (contoh: "Ibadah Remaja (2026-06-06)")
        opt.textContent = `${judul} (${tgl})`;
        
        //masukkan opsi ke dalam dropdown
        select.appendChild(opt);
    });
}

// ==============================================================================================
// 6. FUNGSI UTILITAS & BANTUAN
// ==============================================================================================

//fungsi untuk memunculkan notifikasi pop-up kecil (toast) yang akan hilang sendiri
function showToast(message, type = 'info') {
    //ambil wadah penampung notifikasi toast
    const container = document.getElementById('toast-container');
    if (!container) return;

    //buat elemen div kotak toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    //tentukan ikon yang sesuai dengan jenis pesan (info, sukses, atau error)
    let icon = 'ph-info';
    if (type === 'success') icon = 'ph-check-circle';
    if (type === 'error') icon = 'ph-warning';

    //isi kotak toast dengan ikon dan pesan teks
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    //tempelkan ke dalam kontainer di pojok layar
    container.appendChild(toast);

    //atur waktu otomatis hilangnya notifikasi setelah 3,5 detik
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        //hapus elemen toast dari halaman web setelah transisi animasi selesai
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

//fungsi untuk mengamankan teks dari karakter berbahaya agar terhindar dari serangan XSS
function escapeHtml(str) {
    //jika nilai teks kosong atau tidak ada, kembalikan string kosong
    if (!str) return '';
    //mengubah karakter khusus HTML menjadi kode entitas aman
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
