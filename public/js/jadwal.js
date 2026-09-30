// public/js/jadwal.js
// ==============================================================================================
// FILE LOGIKA UNTUK HALAMAN JADWAL PELAYANAN
// File ini mengatur kalender interaktif, daftar jadwal, filter tanggal, dan form tambah/edit jadwal.
// ==============================================================================================

// --- VARIABEL GLOBAL / STATE APLIKASI ---
// Wadah untuk menampung seluruh daftar jadwal yang didapat dari server/database
let allJadwal = [];

// Wadah untuk menyimpan daftar semua akun anggota (dipakai buat ngisi opsi dropdown tim pelayanan)
let allUsers = [];

// Menyimpan bulan dan tahun yang sedang dilihat di kalender (awalnya diatur ke tanggal & jam sekarang)
let currentCalendarDate = new Date();

// Menyimpan tanggal yang sedang diklik user di kalender untuk menyaring jadwal (formatnya: YYYY-MM-DD)
// Kalau null, artinya sistem sedang menampilkan semua jadwal tanpa difilter tanggal tertentu
let selectedFilterDate = null;

// Menentukan tampilan mana di kolom sebelah kanan yang lagi aktif:
// 'list' = sedang melihat daftar kartu jadwal
// 'form' = sedang membuka form input (tambah baru atau edit)
let currentView = 'list';

// Menyimpan ID jadwal yang lagi diedit. Kalau nilainya null, berarti sedang mau buat jadwal baru
let activeEditId = null;

// Status izin user: bernilai true jika user adalah Admin atau Worship Planner (boleh utak-atik jadwal)
let canManageJadwal = false;

// --- DAFTAR KONSTANTA TEKS BAHASA INDONESIA ---
// Daftar nama hari dalam sepekan (dimulai dari indeks 0 = Minggu)
const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Daftar nama bulan dalam setahun (dimulai dari indeks 0 = Januari)
const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Kamus (mapping) yang menghubungkan nama posisi pelayanan di database dengan ID elemen dropdown <select> di HTML
const TIM_SELECT_IDS = {
    worship_leader: 'select-wl',     // Pemimpin pujian
    singer_1: 'select-singer1',       // Penyanyi 1
    singer_2: 'select-singer2',       // Penyanyi 2
    pianist: 'select-pianist',        // Pemain keyboard / piano
    bassist: 'select-bassist',        // Pemain bass
    gitaris: 'select-gitaris',        // Pemain gitar
    drummer: 'select-drummer',        // Pemain drum
    mcm: 'select-mcm',                // Operator slide / multimedia
    lighting: 'select-lighting',      // Operator tata lampu
    soundman: 'select-soundman',      // Operator tata suara
    usher_1: 'select-usher1',         // Penyambut jemaat 1
    usher_2: 'select-usher2'          // Penyambut jemaat 2
};

// ==============================================================================================
// TITIK AWAL: Saat struktur halaman web (DOM) selesai dimuat seluruhnya oleh browser
// ==============================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Langkah 1: Cek status login dan periksa apakah user berhak menambah/mengubah jadwal
    await initAuthPermissions();

    // Langkah 2: Ambil data nama-nama jemaat/pelayan dari server untuk mengisi opsi dropdown pelayan
    await fetchUsers();

    // Langkah 3: Pasang semua fungsi klik tombol (navigasi kalender, tombol tambah, filter, submit form)
    setupEventListeners();

    // Langkah 4: Ambil seluruh data jadwal dari server dan langsung gambarkan ke kalender serta daftar kartu
    await fetchJadwal();
});

// ==============================================================================================
// 1. FUNGSI CEK HAK AKSES (ROLE & AUTH)
// ==============================================================================================
/**
 * Memeriksa data login pengguna untuk menentukan apakah mereka boleh menambah/mengedit jadwal
 */
async function initAuthPermissions() {
    // Kalau sistem autentikasi Supabase sedang loading di latar belakang, kita tunggu dulu sampai selesai
    if (window.authReady) {
        await window.authReady;
    }

    // Cari tahu apa peran (role) dari user yang sedang login saat ini
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    
    // Tentukan apakah user boleh mengelola jadwal:
    // Hanya Super Admin, Admin, atau Worship Planner yang diizinkan mengelola (true)
    canManageJadwal = window.isSuperAdmin || role === 'admin' || role === 'worship planner';

    // Cari tombol "Tambah Jadwal" di sudut kanan atas halaman
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    
    // Jika tombolnya ada tapi user ini ternyata tidak punya izin (misal: jemaat biasa), sembunyikan tombolnya
    if (btnTambah && !canManageJadwal) {
        btnTambah.style.display = 'none';
    }
}

// ==============================================================================================
// 2. FUNGSI MENGAMBIL DATA AKUN PENGGUNA (UNTUK PILIHAN TIM PELAYANAN)
// ==============================================================================================
/**
 * Mengambil daftar nama semua anggota/pengguna dari backend API
 */
async function fetchUsers() {
    try {
        // Kirim permintaan HTTP GET ke alamat API akun
        const response = await fetch('/api/akun');
        
        // Kalau server merespons dengan sukses (status 200 OK)
        if (response.ok) {
            // Ubah data respons JSON menjadi array objek pengguna dan simpan ke variabel allUsers
            allUsers = await response.json();
            
            // Masukkan nama-nama pengguna ini ke dalam 12 kotak pilihan (dropdown) tim pelayanan
            populateTimPelayananDropdowns();
        }
    } catch (err) {
        // Kalau internet terputus atau server bermasalah, catat peringatan di konsol browser
        console.warn('Gagal memuat akun pengguna:', err);
    }
}

// ==============================================================================================
// 3. FUNGSI MENGISI PILIHAN DROPDOWN TIM PELAYANAN
// ==============================================================================================
/**
 * Mengisi 12 dropdown tim pelayanan dengan nama-nama anggota gereja yang didapat dari database
 */
function populateTimPelayananDropdowns() {
    // Ambil setiap ID dropdown dari daftar TIM_SELECT_IDS satu per satu
    Object.values(TIM_SELECT_IDS).forEach(selectId => {
        // Cari elemen HTML dropdown berdasarkan ID-nya
        const selectEl = document.getElementById(selectId);
        
        // Kalau elemen tidak ditemukan di halaman, lewati saja
        if (!selectEl) return;

        // Kosongkan isi lama dan berikan opsi awal default berupa "-- Pilih --"
        selectEl.innerHTML = '<option value="">-- Pilih --</option>';

        // Telusuri setiap data user yang ada
        allUsers.forEach(user => {
            // Buat elemen tag <option> baru
            const opt = document.createElement('option');
            
            // Nilai yang dikirim saat dipilih adalah nama lengkap anggota
            opt.value = user.nama_lengkap;
            
            // Teks yang dibaca user di layar juga nama lengkap anggota
            opt.textContent = user.nama_lengkap;
            
            // Tempelkan opsi nama ini ke dalam dropdown
            selectEl.appendChild(opt);
        });

        // Cek apakah library Choices.js (fitur pencarian dalam dropdown) sudah terpasang di browser
        if (typeof Choices !== 'undefined') {
            // Aktifkan fitur pencarian di dropdown ini agar user bisa mengetik nama anggota dengan mudah
            new Choices(selectEl, {
                searchEnabled: true,  // Aktifkan kolom ketik pencarian
                itemSelectText: '',   // Hilangkan teks bantuan bawaan "Press to select"
                shouldSort: false     // Jangan acak urutan nama yang sudah dimasukkan
            });
        }
    });
}

// ==============================================================================================
// 4. FUNGSI MENYIAPKAN SELURUH EVENT LISTENER (KLIK & SUBMIT)
// ==============================================================================================
/**
 * Memasang pendengar aksi (event listeners) untuk tombol navigasi, filter, dan form
 */
function setupEventListeners() {
    // Ambil tombol panah navigasi bulan di kalender
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    // Jika tombol 'Bulan Sebelumnya' (<) diklik oleh user
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            // Kurangi angka bulan saat ini sebanyak 1 (mundur 1 bulan)
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            // Gambar ulang tampilan kalender untuk bulan yang baru
            renderCalendar();
        });
    }

    // Jika tombol 'Bulan Berikutnya' (>) diklik oleh user
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            // Tambah angka bulan saat ini sebanyak 1 (maju 1 bulan)
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            // Gambar ulang tampilan kalender untuk bulan yang baru
            renderCalendar();
        });
    }

    // Ambil tombol hijau "+ Tambah Jadwal" di bagian atas halaman
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    if (btnTambah) {
        // Saat diklik, buka form pengisian jadwal baru (null artinya bukan mengedit jadwal lama)
        btnTambah.addEventListener('click', () => {
            openForm(null);
        });
    }

    // Ambil tombol ikon tempat sampah merah di header (yang muncul saat form sedang terbuka)
    const btnTrashHeader = document.getElementById('btn-trash-header');
    if (btnTrashHeader) {
        // Saat diklik, tangani apakah membatalkan input baru atau menghapus jadwal yang sedang diedit
        btnTrashHeader.addEventListener('click', handleTrashHeaderClick);
    }

    // Ambil tombol "Tampilkan Semua Jadwal" pada bar informasi filter tanggal
    const btnResetFilter = document.getElementById('btn-reset-filter');
    if (btnResetFilter) {
        // Saat diklik, buang filter tanggal dan tampilkan kembali semua jadwal
        btnResetFilter.addEventListener('click', () => {
            resetDateFilter();
        });
    }

    // Cari semua tombol pil pilihan kategori di dalam form: Pelayanan, Latihan, atau Event
    const categoryButtons = document.querySelectorAll('.category-pills .btn-category');
    categoryButtons.forEach(btn => {
        // Saat salah satu tombol kategori diklik
        btn.addEventListener('click', (e) => {
            // Ambil nama kategori yang tersimpan di atribut data-category tombol tersebut
            const category = btn.getAttribute('data-category');
            // Terapkan perubahan kategori dan ubah susunan field form sesuai kategorinya
            setCategoryPill(category);
        });
    });

    // Ambil elemen form input jadwal
    const formInline = document.getElementById('form-jadwal-inline');
    if (formInline) {
        // Ketika tombol simpan pada form ditekan atau formulir di-submit, jalankan fungsi handleFormSubmit
        formInline.addEventListener('submit', handleFormSubmit);
    }
}

// ==============================================================================================
// 5. FUNGSI MENGAMBIL DATA JADWAL DARI SERVER (BACKEND API)
// ==============================================================================================
/**
 * Mengambil seluruh jadwal dari server, mengurutkannya, lalu menampilkannya ke layar
 */
async function fetchJadwal() {
    // Ambil elemen wadah tempat kartu-kartu jadwal ditampilkan
    const listContainer = document.getElementById('schedule-cards-list');
    
    // Jika wadah ada dan kita sedang di mode daftar ('list'), tampilkan animasi loading berputar
    if (listContainer && currentView === 'list') {
        listContainer.innerHTML = `
            <div class="loading-state">
                <i class="ph ph-spinner ph-spin"></i>
                <p>Memuat data jadwal...</p>
            </div>
        `;
    }

    try {
        // Kirim permintaan HTTP GET ke endpoint API jadwal
        const response = await fetch('/api/jadwal');
        
        // Jika server mengembalikan status error (bukan 200), lemparkan pesan error
        if (!response.ok) throw new Error('Gagal mengambil data jadwal pelayanan');

        // Baca data jawaban dari server dalam bentuk objek JSON
        const result = await response.json();
        
        // Simpan array jadwal ke variabel allJadwal (jika kosong, gunakan array kosong [])
        allJadwal = result.data || [];

        // Bersihkan dan seragamkan format tanggal jika ada format jam bawaan database (misal: "2026-06-06T00:00:00Z")
        allJadwal.forEach(j => {
            if (j.tanggal && j.tanggal.includes('T')) {
                // Ambil hanya bagian tanggalnya saja di depan huruf 'T' (menjadi "2026-06-06")
                j.tanggal = j.tanggal.split('T')[0];
            }
        });

        // Urutkan jadwal dari tanggal yang paling dekat (terdahulu) ke tanggal yang paling jauh di masa depan
        allJadwal.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        // Gambar ulang kalender di sisi kiri agar tanggal-tanggal yang ada acaranya diberi tanda titik (dot)
        renderCalendar();
        
        // Jika sedang di mode melihat daftar, gambarkan kartu-kartu jadwal di sisi kanan
        if (currentView === 'list') {
            renderScheduleList();
        }

    } catch (error) {
        // Kalau terjadi kegagalan jaringan atau server mati, tampilkan pesan error di konsol dan di layar
        console.error('Error fetching jadwal:', error);
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-warning-circle" style="font-size: 2.5rem; color: #ef4444;"></i>
                    <p style="margin-top: 10px; color: #ef4444;">${error.message}</p>
                    <button class="btn-primary" onclick="fetchJadwal()" style="margin-top: 15px;">Coba Lagi</button>
                </div>
            `;
        }
    }
}

// ==============================================================================================
// 6. FUNGSI MENGGAMBAR KALENDER INTERAKTIF DI SISI KIRI
// ==============================================================================================
/**
 * Menghitung tanggal dan merender grid kalender sesuai bulan & tahun yang aktif
 */
function renderCalendar() {
    // Ambil elemen teks judul bulan-tahun dan kotak grid tempat tanggal-tanggal diletakkan
    const monthYearText = document.getElementById('month-year-text');
    const datesGrid = document.getElementById('calendar-dates-grid');

    // Jika salah satu elemen di atas tidak ditemukan, hentikan fungsi
    if (!monthYearText || !datesGrid) return;

    // Dapatkan tahun dan bulan angka (0 = Januari, 11 = Desember) dari state kalender saat ini
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Perbarui tulisan judul bulan & tahun di atas kalender (contoh: "Juni 2026")
    monthYearText.textContent = `${BULAN_INDONESIA[month]} ${year}`;

    // Cari tahu hari apa tanggal 1 pada bulan ini jatuh (0 = Minggu, 1 = Senin, dst)
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    // Cari tahu ada berapa total jumlah hari di bulan ini (misal 30 atau 31 hari)
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Dapatkan tanggal riil hari ini untuk penandaan visual khusus
    const today = new Date();
    // Cek apakah kalender yang lagi dilihat ini adalah bulan & tahun saat ini
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    // Jika benar bulan ini, catat angka tanggalnya (misal: 28), jika bukan beri null
    const todayDate = isCurrentMonth ? today.getDate() : null;

    // Kumpulkan tanggal-tanggal berapa saja yang memiliki jadwal kegiatan di bulan yang sedang ditampilkan
    const eventDatesInMonth = new Set();
    allJadwal.forEach(j => {
        if (!j.tanggal) return;
        const d = new Date(j.tanggal);
        // Jika tahun dan bulannya cocok dengan yang sedang dilihat user
        if (d.getFullYear() === year && d.getMonth() === month) {
            // Masukkan angka harinya ke dalam Set (supaya tidak ada tanggal duplikat)
            eventDatesInMonth.add(d.getDate());
        }
    });

    // Kosongkan isi grid kalender yang lama sebelum menggambar yang baru
    datesGrid.innerHTML = '';

    // Buat kotak sel kosong sebelum tanggal 1 agar posisi hari (Minggu, Senin, dst) sejajar dengan benar
    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-blank-cell';
        datesGrid.appendChild(blank);
    }

    // Buat kotak sel tanggal mulai dari tanggal 1 hingga hari terakhir di bulan tersebut
    for (let day = 1; day <= totalDays; day++) {
        // Buat elemen kotak tanggal
        const cell = document.createElement('div');
        cell.className = 'date-cell';
        cell.textContent = day;

        // Susun format tanggal standar YYYY-MM-DD dengan menambahkan angka 0 di depan jika di bawah 10
        const monthFormatted = String(month + 1).padStart(2, '0');
        const dayFormatted = String(day).padStart(2, '0');
        const dateString = `${year}-${monthFormatted}-${dayFormatted}`;

        // Jika tanggal ini adalah hari ini, berikan penanda visual lingkaran khusus ('today')
        if (day === todayDate) {
            cell.classList.add('today');
        }

        // Jika pada tanggal ini terdapat jadwal kegiatan, beri tanda titik oranye/kuning ('event-dot')
        if (eventDatesInMonth.has(day)) {
            cell.classList.add('event-dot');
            cell.title = 'Ada jadwal pelayanan';
        }

        // Jika tanggal ini sama dengan tanggal yang sedang difilter/dipilih oleh user, beri gaya aktif ('selected')
        if (selectedFilterDate === dateString) {
            cell.classList.add('selected');
        }

        // Pasang aksi saat kotak tanggal ini diklik oleh pengguna
        cell.addEventListener('click', () => {
            // KONDISI 1: User sedang membuka Form Input (Tambah / Edit)
            if (currentView === 'form') {
                // Mengklik tanggal di kalender langsung otomatis mengisi input field tanggal pada formulir!
                document.getElementById('input-tanggal').value = dateString;
                selectedFilterDate = dateString;
                // Gambar ulang kalender untuk memindahkan sorotan warna ke tanggal baru ini
                renderCalendar();
            } 
            // KONDISI 2: User sedang di mode melihat Daftar Kartu Jadwal
            else {
                // Jika user mengklik tanggal yang sebelumnya sudah aktif dipilih, batalkan filternya
                if (selectedFilterDate === dateString) {
                    resetDateFilter();
                } else {
                    // Jika mengklik tanggal baru, aktifkan filter untuk tanggal tersebut
                    selectedFilterDate = dateString;
                    renderCalendar();
                    // Saring kartu jadwal di sebelah kanan hanya untuk tanggal ini saja
                    renderScheduleList();
                }
            }
        });

        // Tempelkan kotak tanggal yang sudah selesai dibuat ke dalam grid kalender
        datesGrid.appendChild(cell);
    }
}

// ==============================================================================================
// 7. FUNGSI RESET FILTER TANGGAL
// ==============================================================================================
/**
 * Menghapus pilihan filter tanggal agar seluruh jadwal kembali ditampilkan
 */
function resetDateFilter() {
    // Kosongkan variabel tanggal terpilih
    selectedFilterDate = null;
    
    // Perbarui kalender (menghilangkan warna sorotan pada tanggal yang tadi diklik)
    renderCalendar();
    
    // Tampilkan kembali semua daftar jadwal tanpa filter
    renderScheduleList();
}

// ==============================================================================================
// 8. FUNGSI MEMBUKA FORM TAMBAH ATAU EDIT JADWAL (TAMPILAN FORM DI SISI KANAN)
// ==============================================================================================
/**
 * Mengganti tampilan kanan dari daftar kartu menjadi form input jadwal
 * @param {Object|null} editData - Jika diisi data jadwal, maka menjadi Mode Edit. Jika null, Mode Tambah Baru.
 */
function openForm(editData = null) {
    // Ubah status tampilan aktif menjadi 'form'
    currentView = 'form';
    
    // Catat ID jadwal yang mau diedit (kalau tambah baru, nilainya null)
    activeEditId = editData ? editData.id : null;

    // Sembunyikan bagian daftar kartu jadwal di kolom kanan
    document.getElementById('schedule-list-section').style.display = 'none';
    
    // Munculkan bagian form input jadwal di kolom kanan
    document.getElementById('schedule-form-section').style.display = 'block';

    // Atur tombol aksi di bagian header halaman:
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    const btnTrash = document.getElementById('btn-trash-header');
    
    // Sembunyikan tombol "Tambah Jadwal" karena form sudah terbuka
    if (btnTambah) btnTambah.style.display = 'none';
    
    // Munculkan tombol ikon tempat sampah merah di header (untuk membatalkan atau menghapus jadwal)
    if (btnTrash) btnTrash.style.display = 'inline-flex';

    // Sembunyikan bar info filter tanggal agar tampilan form bersih dan rapi
    const filterBar = document.getElementById('filter-status-bar');
    if (filterBar) filterBar.style.display = 'none';

    // Bersihkan seluruh isian form sebelumnya (reset formulir)
    const form = document.getElementById('form-jadwal-inline');
    form.reset();

    // Ambil elemen tombol submit hijau di bagian bawah form
    const submitBtn = document.getElementById('btn-submit-form');

    // JIKA DALAM MODE EDIT JADWAL (DATA LAMA DIKIRIMKAN):
    if (editData) {
        // Ganti label tombol submit menjadi "Simpan Perubahan"
        submitBtn.textContent = 'Simpan Perubahan';
        
        // Masukkan ID jadwal lama ke input tersembunyi
        document.getElementById('input-jadwal-id').value = editData.id;

        // Pilih tombol pil kategori sesuai data lama (misal: "Pelayanan", "Latihan", atau "Event")
        setCategoryPill(editData.kategori || 'Pelayanan');

        // Isi kolom input teks dengan data jadwal yang sudah ada
        document.getElementById('input-tema').value = editData.judul || '';
        document.getElementById('input-ringkasan').value = editData.tujuan || '';
        document.getElementById('input-pengkotbah').value = editData.pengkotbah || '';
        document.getElementById('input-tanggal').value = editData.tanggal || '';
        document.getElementById('input-waktu').value = editData.waktu || '17:00';

        // Ambil data penugasan tim pelayanan
        const tim = editData.tim_pelayanan || {};
        
        // Cocokkan setiap posisi pelayanan dan atur nilai dropdown-nya sesuai data lama
        Object.entries(TIM_SELECT_IDS).forEach(([roleKey, selectId]) => {
            const selectEl = document.getElementById(selectId);
            if (selectEl && tim[roleKey]) {
                selectEl.value = tim[roleKey];
            }
        });

        // Tandai tanggal jadwal ini di kalender
        selectedFilterDate = editData.tanggal;
        renderCalendar();
    } 
    // JIKA DALAM MODE TAMBAH JADWAL BARU:
    else {
        // Beri teks tombol submit "Tambah Jadwal"
        submitBtn.textContent = 'Tambah Jadwal';
        
        // Pastikan input ID jadwal tersembunyi dalam keadaan kosong
        document.getElementById('input-jadwal-id').value = '';

        // Tentukan kategori default awal sebagai "Pelayanan"
        setCategoryPill('Pelayanan');

        // Tentukan tanggal bawaan awal:
        // Jika user tadi sedang memilih suatu tanggal di kalender, gunakan tanggal itu
        if (selectedFilterDate) {
            document.getElementById('input-tanggal').value = selectedFilterDate;
        } else {
            // Kalau belum memilih tanggal apa pun, cari hari Sabtu terdekat secara otomatis
            const d = new Date();
            const dayOfWeek = d.getDay(); // 0 = Minggu, 6 = Sabtu
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
            d.setDate(d.getDate() + (daysUntilSaturday === 0 ? 0 : daysUntilSaturday));
            
            // Formatkan tanggal Sabtu tersebut ke format YYYY-MM-DD
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const defaultDate = `${yyyy}-${mm}-${dd}`;
            
            // Pasang ke input tanggal dan sorot di kalender
            document.getElementById('input-tanggal').value = defaultDate;
            selectedFilterDate = defaultDate;
            renderCalendar();
        }

        // Tentukan jam default pelaksanaan ibadah, yaitu pukul 17:00 WIB
        document.getElementById('input-waktu').value = '17:00';
    }

    // Kembalikan posisi scroll form ke paling atas agar user langsung melihat judul form
    const formCard = document.getElementById('schedule-form-section');
    if (formCard) formCard.scrollTop = 0;
}

// ==============================================================================================
// 9. FUNGSI MENGATUR PIL KATEGORI (PELAYANAN, LATIHAN, EVENT)
// ==============================================================================================
/**
 * Mengubah tombol kategori yang aktif dan menyesuaikan field-field formulir yang relevan
 * @param {string} categoryName - Nama kategori ('Pelayanan', 'Latihan', atau 'Event')
 */
function setCategoryPill(categoryName) {
    // Pastikan kategori yang dimasukkan valid, jika tidak ada gunakan default 'Pelayanan'
    const validCategory = categoryName || 'Pelayanan';
    
    // Simpan nilai kategori ke input tersembunyi agar ikut terkirim saat form di-submit
    document.getElementById('input-kategori').value = validCategory;
    
    // Berikan efek visual tombol aktif pada tombol yang sesuai dan matikan efek pada tombol lainnya
    const categoryButtons = document.querySelectorAll('.category-pills .btn-category');
    categoryButtons.forEach(btn => {
        if (btn.getAttribute('data-category') === validCategory) {
            btn.classList.add('active'); // Tombol yang dipilih ditandai aktif
        } else {
            btn.classList.remove('active'); // Tombol lainnya dinonaktifkan
        }
    });

    // Sesuaikan label teks dan sembunyikan/tampilkan field form yang cocok untuk kategori ini
    applyCategoryFormLayout(validCategory);
}

// ==============================================================================================
// 10. FUNGSI MENYESUAIKAN TAMPILAN FORM BERDASARKAN KATEGORI
// ==============================================================================================
/**
 * Mengubah label kolom form secara dinamis (contoh: Latihan tidak butuh kolom pengkotbah)
 * @param {string} categoryName - Kategori yang sedang dipilih
 */
function applyCategoryFormLayout(categoryName) {
    // Ambil elemen-elemen label dan input yang akan disesuaikan
    const labelTema = document.getElementById('label-tema');
    const inputTema = document.getElementById('input-tema');
    const labelRingkasan = document.getElementById('label-ringkasan');
    const inputRingkasan = document.getElementById('input-ringkasan');
    const fieldPengkotbah = document.getElementById('field-pengkotbah');
    const inputPengkotbah = document.getElementById('input-pengkotbah');
    
    // Ambil elemen peran tambahan yang hanya dibutuhkan pada ibadah utama (Drummer, MCM, Sound, Usher, dll)
    const extraRoles = document.querySelectorAll('.role-pelayanan-only');

    // JIKA KATEGORI ADALAH 'LATIHAN':
    if (categoryName === 'Latihan') {
        // 1. Ubah label Tema Kotbah menjadi "Nama Latihan"
        if (labelTema) labelTema.textContent = 'Nama Latihan';
        if (inputTema) inputTema.placeholder = '';

        // 2. Ubah label Ringkasan menjadi "Untuk Latihan Ibadah kapan?"
        if (labelRingkasan) labelRingkasan.textContent = 'Untuk Latihan Ibadah kapan?';
        if (inputRingkasan) inputRingkasan.placeholder = '';

        // 3. Sembunyikan kolom Pengkotbah karena sesi latihan tidak memerlukan pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = 'none';
        if (inputPengkotbah) inputPengkotbah.value = '';

        // 4. Sembunyikan peran pelayan selain musik inti (hanya menyisakan WL, Singer 1 & 2, Piano, Bass, Gitar)
        extraRoles.forEach(el => {
            el.style.display = 'none';
            const select = el.querySelector('select');
            // Jika sedang buat baru, kosongkan pilihan yang disembunyikan
            if (select && currentView === 'form' && !activeEditId) select.value = '';
        });

    } 
    // JIKA KATEGORI ADALAH 'EVENT':
    else if (categoryName === 'Event') {
        // 1. Ubah label menjadi "Nama Event"
        if (labelTema) labelTema.textContent = 'Nama Event';
        if (inputTema) inputTema.placeholder = '';

        // 2. Ubah label ringkasan menjadi "Tema"
        if (labelRingkasan) labelRingkasan.textContent = 'Tema';
        if (inputRingkasan) inputRingkasan.placeholder = '';

        // 3. Sembunyikan kolom Pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = 'none';
        if (inputPengkotbah) inputPengkotbah.value = '';

        // 4. Sembunyikan peran-peran teknis ibadah mingguan
        extraRoles.forEach(el => {
            el.style.display = 'none';
            const select = el.querySelector('select');
            if (select && currentView === 'form' && !activeEditId) select.value = '';
        });

    } 
    // JIKA KATEGORI ADALAH 'PELAYANAN' (IBADAH UTAMA / DEFAULT):
    else {
        // Kembalikan label ke format standar ibadah
        if (labelTema) labelTema.textContent = 'Tema Kotbah';
        if (inputTema) inputTema.placeholder = 'Masukkan tema kotbah...';

        if (labelRingkasan) labelRingkasan.textContent = 'Ringkasan / Tujuan';
        if (inputRingkasan) inputRingkasan.placeholder = 'Masukkan ringkasan atau tujuan firman...';

        // Tampilkan kembali kolom pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = '';

        // Tampilkan seluruh 12 peran tim pelayanan secara lengkap
        extraRoles.forEach(el => el.style.display = '');
    }
}

// ==============================================================================================
// 11. FUNGSI MENUTUP FORM DAN KEMBALI KE DAFTAR KARTU JADWAL
// ==============================================================================================
/**
 * Menutup form input dan mengembalikan layar ke tampilan daftar jadwal
 */
function closeForm() {
    // Ubah status tampilan aktif kembali ke mode 'list'
    currentView = 'list';
    
    // Hapus ID jadwal aktif yang tadi diedit
    activeEditId = null;

    // Sembunyikan formulir input
    document.getElementById('schedule-form-section').style.display = 'none';
    
    // Tampilkan kembali wadah daftar kartu jadwal
    document.getElementById('schedule-list-section').style.display = 'block';

    // Atur tombol aksi di bagian header:
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    const btnTrash = document.getElementById('btn-trash-header');
    
    // Tampilkan kembali tombol "+ Tambah Jadwal" jika user memiliki izin
    if (btnTambah && canManageJadwal) btnTambah.style.display = 'inline-flex';
    
    // Sembunyikan tombol ikon tempat sampah merah
    if (btnTrash) btnTrash.style.display = 'none';

    // Gambar ulang kartu jadwal untuk memastikan data yang ditampilkan adalah data paling baru
    renderScheduleList();
}

// ==============================================================================================
// 12. FUNGSI MENANGANI KLIK TOMBOL TRASH DI HEADER (BATAL / HAPUS)
// ==============================================================================================
/**
 * Menangani fungsi tombol tempat sampah merah di sudut kanan atas:
 * - Jika sedang edit jadwal: bertindak sebagai tombol HAPUS JADWAL dari database
 * - Jika sedang tambah jadwal baru: bertindak sebagai tombol BATAL dan kembali ke list
 */
async function handleTrashHeaderClick() {
    // KONDISI 1: User sedang mengedit jadwal yang sudah ada di database
    if (activeEditId) {
        // Cari data jadwal ini di memori untuk menampilkan judulnya pada kotak konfirmasi
        const item = allJadwal.find(j => String(j.id) === String(activeEditId));
        const judul = item ? item.judul : 'jadwal ini';

        // Tanyakan konfirmasi kepada user sebelum menghapus secara permanen
        if (confirm(`Apakah Anda yakin ingin menghapus jadwal:\n"${judul}"?`)) {
            try {
                // Kirim permintaan HTTP DELETE ke backend API
                const res = await fetch(`/api/jadwal/${activeEditId}`, { method: 'DELETE' });
                
                // Jika penghapusan gagal, lempar pesan error
                if (!res.ok) throw new Error('Gagal menghapus');
                
                // Ambil kembali daftar jadwal terbaru dari database
                await fetchJadwal();
                
                // Tutup form dan kembali ke tampilan daftar kartu
                closeForm();
            } catch (err) {
                // Tampilkan pesan jika terjadi kesalahan
                alert('Gagal menghapus jadwal: ' + err.message);
            }
        }
    } 
    // KONDISI 2: User sedang membuat jadwal baru dan ingin membatalkannya
    else {
        // Langsung tutup form dan kembali ke daftar kartu
        closeForm();
    }
}

// ==============================================================================================
// 13. FUNGSI MEMPROSES SUBMIT FORMULIR JADWAL (SIMPAN / EDIT)
// ==============================================================================================
/**
 * Mengirim data form ke backend API saat tombol "Tambah Jadwal" atau "Simpan Perubahan" diklik
 * @param {Event} e - Objek event submit dari browser
 */
async function handleFormSubmit(e) {
    // Hentikan perilaku bawaan browser (supaya halaman web tidak me-refresh sendiri)
    e.preventDefault();

    // Ambil seluruh nilai yang sudah diketik oleh pengguna di formulir
    const id = document.getElementById('input-jadwal-id').value;
    const kategori = document.getElementById('input-kategori').value || 'Pelayanan';
    const tema_kotbah = document.getElementById('input-tema').value.trim();
    const ringkasan_tujuan = document.getElementById('input-ringkasan').value.trim();
    const pengkotbah = document.getElementById('input-pengkotbah').value.trim();
    const tanggal = document.getElementById('input-tanggal').value;
    const waktu = document.getElementById('input-waktu').value || '17:00';

    // Validasi dasar: pastikan Tanggal dan Judul/Tema tidak dibiarkan kosong oleh pengguna
    if (!tanggal || !tema_kotbah) {
        const namaField = kategori === 'Latihan' ? 'Nama Latihan' : (kategori === 'Event' ? 'Nama Event' : 'Tema Kotbah');
        alert(`Tanggal dan ${namaField} wajib diisi!`);
        return;
    }

    // Kumpulkan nama-nama pelayan dari ke-12 kotak dropdown
    const tim_pelayanan = {};
    Object.entries(TIM_SELECT_IDS).forEach(([roleKey, selectId]) => {
        const selectEl = document.getElementById(selectId);
        // Masukkan nama orang yang dipilih (atau string kosong jika tidak ditugaskan siapa pun)
        tim_pelayanan[roleKey] = selectEl ? selectEl.value : '';
    });

    // Bungkus semua data di atas ke dalam satu objek payload JSON yang siap dikirim ke backend
    const payload = {
        kategori,
        judul: tema_kotbah,
        tema_kotbah,
        tujuan: ringkasan_tujuan,
        ringkasan_tujuan,
        pengkotbah: (kategori === 'Latihan' || kategori === 'Event') ? '' : pengkotbah,
        tanggal,
        waktu,
        tim_pelayanan
    };

    // Tentukan apakah aksi ini adalah Edit (jika ID ada) atau Tambah Baru (jika ID kosong)
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/jadwal/${id}` : '/api/jadwal'; // URL endpoint API yang dituju
    const method = isEdit ? 'PUT' : 'POST';                 // Metode HTTP (PUT untuk edit, POST untuk baru)

    // Ambil tombol submit untuk memberikan efek visual sedang memproses
    const submitBtn = document.getElementById('btn-submit-form');
    const originalText = submitBtn.textContent;
    
    // Matikan tombol sementara dan ubah teksnya agar user tidak mengklik berkali-kali
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
        // Kirim data ke backend menggunakan fetch API
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Baca hasil balasan dari server
        const result = await response.json();
        
        // Jika server mengembalikan pesan error, lemparkan pesan tersebut
        if (!response.ok) {
            throw new Error(result.message || result.error || 'Gagal menyimpan jadwal');
        }

        // Ambil data jadwal terbaru dari server agar tampilan langsung sinkron
        await fetchJadwal();
        
        // Tutup form dan kembali ke tampilan daftar kartu
        closeForm();

    } catch (error) {
        // Tampilkan pesan peringatan jika terjadi kegagalan menyimpan
        console.error('Error saving jadwal:', error);
        alert(error.message);
    } finally {
        // Kembalikan tombol ke keadaan semula (bisa diklik lagi) apa pun hasilnya
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ==============================================================================================
// 14. FUNGSI MERENDER KARTU-KARTU JADWAL (TAMPILAN DAFTAR DI SISI KANAN)
// ==============================================================================================
/**
 * Menggambar seluruh kartu jadwal ke dalam daftar di kolom kanan
 */
function renderScheduleList() {
    // Ambil elemen-elemen antarmuka yang akan dimanipulasi
    const listContainer = document.getElementById('schedule-cards-list');
    const badgeCount = document.getElementById('schedule-count-badge');
    const filterStatusBar = document.getElementById('filter-status-bar');
    const filterDateText = document.getElementById('filter-date-text');
    const listTitle = document.getElementById('list-title');

    // Jika wadah daftar kartu tidak ditemukan di HTML, hentikan fungsi
    if (!listContainer) return;

    // Siapkan data jadwal yang akan ditampilkan
    let displayedJadwal = allJadwal;
    
    // PENGECEKAN FILTER TANGGAL:
    // Jika ada tanggal yang sedang diklik user di kalender
    if (selectedFilterDate) {
        // Saring jadwal: ambil hanya jadwal yang tanggalnya sama persis dengan tanggal yang diklik
        displayedJadwal = allJadwal.filter(j => j.tanggal === selectedFilterDate);
        
        // Tampilkan bilah informasi status filter di atas daftar
        if (filterStatusBar && filterDateText) {
            filterStatusBar.style.display = 'flex';
            filterDateText.textContent = formatTanggalLengkap(selectedFilterDate);
        }
        // Ubah judul daftar menjadi "Jadwal Terpilih"
        if (listTitle) listTitle.textContent = 'Jadwal Terpilih';
    } else {
        // Jika tidak ada filter tanggal, sembunyikan bilah status filter
        if (filterStatusBar) filterStatusBar.style.display = 'none';
        // Kembalikan judul daftar menjadi "Daftar Pelayanan"
        if (listTitle) listTitle.textContent = 'Daftar Pelayanan';
    }

    // Perbarui angka jumlah jadwal pada lencana (badge) di atas daftar (contoh: "3 Jadwal")
    if (badgeCount) {
        badgeCount.textContent = `${displayedJadwal.length} Jadwal`;
    }

    // JIKA TIDAK ADA JADWAL UNTUK DITAMPILKAN (KOSONG):
    if (displayedJadwal.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-calendar-x" style="font-size: 3rem; color: #94a3b8;"></i>
                <p style="margin-top: 12px; font-weight: 500; color: #64748b;">
                    ${selectedFilterDate ? 'Tidak ada jadwal pelayanan pada tanggal ini.' : 'Belum ada jadwal pelayanan terdaftar.'}
                </p>
                ${selectedFilterDate ? `
                    <button class="btn-reset-filter" onclick="resetDateFilter()" style="margin-top: 12px;">
                        Tampilkan Semua Jadwal
                    </button>
                ` : (canManageJadwal ? `
                    <button class="btn-primary" onclick="openForm()" style="margin-top: 15px;">
                        <i class="ph ph-plus-circle"></i> Tambah Jadwal Pertama
                    </button>
                ` : '')}
            </div>
        `;
        return;
    }

    // KOSONGKAN WADAH DAN MULAI MERENDER SETIAP KARTU JADWAL
    listContainer.innerHTML = '';
    
    // Telusuri setiap data jadwal yang lolos seleksi filter
    displayedJadwal.forEach(item => {
        // Buat elemen pembungkus kartu jadwal
        const card = document.createElement('div');
        card.className = 'schedule-card';

        // Ubah format tanggal menjadi format lengkap yang enak dibaca (contoh: "Sabtu, 6 Juni 2026")
        const formattedDate = formatTanggalLengkap(item.tanggal);

        // Identifikasi jenis kategori jadwal
        const isLatihan = item.kategori === 'Latihan';
        const isEvent = item.kategori === 'Event';
        let badgeKategori = '';
        let cardBodyContent = '';

        // Sesuaikan isi tubuh kartu sesuai kategorinya:
        if (isLatihan) {
            // Tampilan kartu untuk Latihan
            badgeKategori = '• <span style="color:#0284c7;">LATIHAN</span>';
            cardBodyContent = `
                <div class="info-group" style="grid-column: 1 / -1;">
                    <label>UNTUK LATIHAN IBADAH</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
            `;
        } else if (isEvent) {
            // Tampilan kartu untuk Event khusus
            badgeKategori = '• <span style="color:#0d9488;">EVENT</span>';
            cardBodyContent = `
                <div class="info-group" style="grid-column: 1 / -1;">
                    <label>TEMA EVENT</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
            `;
        } else {
            // Tampilan kartu untuk Ibadah Pelayanan mingguan (standar)
            cardBodyContent = `
                <div class="info-group">
                    <label>TUJUAN</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
                <div class="info-group">
                    <label>PENGKOTBAH</label>
                    <p class="bold">${escapeHtml(item.pengkotbah || '-')}</p>
                </div>
            `;
        }

        // Susun struktur isi HTML kartu jadwal
        card.innerHTML = `
            <div class="card-header">
                <span class="card-date">${formattedDate.toUpperCase()} ${badgeKategori}</span>
                <button class="btn-detail" title="Lihat & Edit Jadwal">
                    <i class="ph ph-arrow-right"></i>
                </button>
            </div>
            <h2 class="card-title">${escapeHtml(item.judul)}</h2>
            <div class="card-body">
                ${cardBodyContent}
            </div>
            ${canManageJadwal ? `
                <div class="card-footer">
                    <button class="btn-card-edit" title="Edit Jadwal">
                        <i class="ph ph-pencil-simple"></i> Edit
                    </button>
                    <button class="btn-card-delete" title="Hapus Jadwal">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            ` : ''}
        `;

        // PASANG AKSI KLIK PADA KARTU:
        card.addEventListener('click', (e) => {
            // 1. Jika yang diklik adalah tombol ikon tempat sampah di dalam kartu (Hapus)
            if (e.target.closest('.btn-card-delete')) {
                e.stopPropagation(); // Cegah klik tembus ke kartu utama
                hapusCardJadwal(item.id, item.judul);
                return;
            }
            
            // 2. Jika yang diklik adalah tombol "Edit" di dalam kartu
            if (e.target.closest('.btn-card-edit')) {
                e.stopPropagation(); // Cegah klik tembus ke kartu utama
                openForm(item); // Buka form langsung terisi dengan data jadwal ini
                return;
            }
            
            // 3. Jika yang diklik adalah bagian badan kartu atau tombol panah detail
            // Pindahkan halaman user ke halaman detail jadwal lengkap
            window.location.href = `/detail-jadwal.html?id=${item.id}`;
        });

        // Tempelkan kartu yang sudah rapi ke dalam daftar kartu di halaman
        listContainer.appendChild(card);
    });
}

// ==============================================================================================
// 15. FUNGSI MENGHAPUS JADWAL DARI TOMBOL KARTU
// ==============================================================================================
/**
 * Menghapus jadwal tertentu saat tombol sampah pada kartu diklik
 * @param {string|number} id - ID jadwal yang ingin dihapus
 * @param {string} judul - Judul jadwal untuk konfirmasi pengguna
 */
async function hapusCardJadwal(id, judul) {
    // Tampilkan dialog konfirmasi penghapusan agar tidak terhapus tidak sengaja
    if (!confirm(`Apakah Anda yakin ingin menghapus jadwal:\n"${judul}"?`)) {
        return; // Batalkan jika user menekan tombol Cancel
    }

    try {
        // Kirim permintaan HTTP DELETE ke backend
        const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
        
        // Jika server mengabarkan gagal hapus, lempar error
        if (!res.ok) throw new Error('Gagal menghapus');
        
        // Refresh data jadwal terbaru dari server
        await fetchJadwal();
    } catch (err) {
        // Tampilkan pesan jika terjadi kesalahan
        alert('Gagal menghapus jadwal: ' + err.message);
    }
}

// ==============================================================================================
// 16. FUNGSI BANTUAN: FORMAT TANGGAL KE BAHASA INDONESIA LENGKAP
// ==============================================================================================
/**
 * Mengubah format tanggal mentah "2026-06-06" menjadi format ramah "Sabtu, 6 Juni 2026"
 * @param {string} dateStr - Format tanggal YYYY-MM-DD
 * @returns {string} - Teks tanggal bahasa Indonesia yang rapi
 */
function formatTanggalLengkap(dateStr) {
    // Jika tidak ada data tanggal yang diberikan, kembalikan strip (-)
    if (!dateStr) return '-';
    
    // Pecah string tanggal berdasarkan tanda hubung '-' menjadi [tahun, bulan, tanggal]
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Kurangi 1 karena indeks bulan di JS dimulai dari 0
        const day = parseInt(parts[2], 10);
        
        // Buat objek Date dari tahun, bulan, dan hari tersebut
        const dateObj = new Date(year, month, day);

        // Ambil nama hari dan nama bulan dalam Bahasa Indonesia
        const namaHari = HARI_INDONESIA[dateObj.getDay()];
        const namaBulan = BULAN_INDONESIA[month];
        
        // Gabungkan menjadi kalimat tanggal yang lengkap
        return `${namaHari}, ${day} ${namaBulan} ${year}`;
    }
    
    // Jika format tidak sesuai pecahan 3 bagian, kembalikan apa adanya
    return dateStr;
}

// ==============================================================================================
// 17. FUNGSI BANTUAN: PENGAMAN DARI SERANGAN XSS (ESCAPE HTML)
// ==============================================================================================
/**
 * Mengamankan teks dari karakter berbahaya agar tidak bisa menyisipkan skrip jahat (XSS)
 * @param {string} str - Teks mentah yang akan dibersihkan
 * @returns {string} - Teks aman dengan entitas HTML
 */
function escapeHtml(str) {
    // Jika teks kosong atau bukan teks, kembalikan string kosong
    if (!str) return '';
    
    // Ubah karakter khusus HTML menjadi kode entitas yang tidak bisa dieksekusi browser
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
