//wadah untuk menampung seluruh daftar jadwal yang didapat dari server/database
let allJadwal = [];

//wadah untuk menyimpan daftar semua akun anggota (dipakai buat ngisi opsi dropdown tim pelayanan)
let allUsers = [];

//menyimpan bulan dan tahun yang sedang dilihat di kalender (awalnya diatur ke tanggal & jam sekarang)
let currentCalendarDate = new Date();

//menyimpan tanggal yang sedang diklik user di kalender untuk menyaring jadwal (formatnya: YYYY-MM-DD)
//kalau null, artinya sistem sedang menampilkan semua jadwal tanpa difilter tanggal tertentu
let selectedFilterDate = null;

//menentukan tampilan mana di kolom sebelah kanan yang lagi aktif:
//'list' = sedang melihat daftar kartu jadwal
//'form' = sedang membuka form input (tambah baru atau edit)
let currentView = 'list';

//menyimpan ID jadwal yang lagi diedit. Kalau nilainya null, berarti sedang mau buat jadwal baru
let activeEditId = null;

//status izin user: bernilai true jika user adalah Admin atau Worship Planner (boleh utak-atik jadwal)
let canManageJadwal = false;

//daftar nama hari dalam sepekan (dimulai dari indeks 0 = Minggu)
const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

//daftar nama bulan dalam setahun (dimulai dari indeks 0 = Januari)
const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

//kamus (mapping) yang menghubungkan nama posisi pelayanan di database dengan ID elemen dropdown <select> di HTML
const TIM_SELECT_IDS = {
    worship_leader: 'select-wl',
    singer_1: 'select-singer1',
    singer_2: 'select-singer2',
    pianist: 'select-pianist',
    bassist: 'select-bassist',
    gitaris: 'select-gitaris',
    drummer: 'select-drummer',
    mcm: 'select-mcm',
    lighting: 'select-lighting',
    soundman: 'select-soundman',
    usher: 'select-usher'
};

// Wadah untuk menyimpan instans Choices.js dari dropdown tim pelayanan
let choicesInstances = {};

// Parameter navigasi jika diarahkan dari halaman Berhalangan ("Edit Pelayan")
const urlParamsJadwal = new URLSearchParams(window.location.search);
let pendingEditIdFromUrl = urlParamsJadwal.get('edit_id');
const cameFromBerhalangan = urlParamsJadwal.get('from') === 'berhalangan';
const berhalanganChatId = urlParamsJadwal.get('chat_id');

//saat struktur halaman web (DOM) selesai dimuat seluruhnya oleh browser
document.addEventListener('DOMContentLoaded', async () => {
    // Jika diarahkan dari halaman Berhalangan, tampilkan tombol Back ke Berhalangan
    const btnBackBerhalangan = document.getElementById('btn-back-berhalangan');
    if (btnBackBerhalangan && cameFromBerhalangan) {
        btnBackBerhalangan.style.display = 'inline-flex';
        btnBackBerhalangan.addEventListener('click', () => {
            window.location.href = '/berhalangan';
        });
    }

    //cek status login dan periksa apakah user berhak menambah/mengubah jadwal
    await initAuthPermissions();

    //ambil data nama-nama jemaat/pelayan dari server untuk mengisi opsi dropdown pelayan
    await fetchUsers();

    //pasang semua fungsi klik tombol (navigasi kalender, tombol tambah, filter, submit form)
    setupEventListeners();

    //ambil seluruh data jadwal dari server dan langsung gambarkan ke kalender serta daftar kartu
    await fetchJadwal();
});

// ==============================================================================================
// 1. FUNGSI CEK HAK AKSES (ROLE & AUTH)
// ==============================================================================================
/**
 * Memeriksa data login pengguna untuk menentukan apakah mereka boleh menambah/mengedit jadwal
 */
async function initAuthPermissions() {
    //kalau sistem autentikasi Supabase sedang loading di latar belakang, kita tunggu dulu sampai selesai
    if (window.authReady) {
        await window.authReady;
    }

    //cari tahu apa peran (role) dari user yang sedang login saat ini
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');

    //tentukan apakah user boleh mengelola jadwal:
    //hanya super admin, admin, atau worship planner yang diizinkan mengelola (true)
    canManageJadwal = window.isSuperAdmin || role === 'admin' || role === 'worship planner';

    //cari tombol "tambah jadwal" di sudut kanan atas halaman
    const btnTambah = document.getElementById('btn-tambah-jadwal');

    //jika tombolnya ada tapi user ini ternyata tidak punya izin (misal: jemaat biasa), sembunyikan tombolnya
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
        //kirim permintaan HTTP GET ke alamat API akun
        const response = await fetch('/api/akun');

        //kalau server merespons dengan sukses
        if (response.ok) {
            //ubah data respons JSON menjadi array objek pengguna dan simpan ke variabel allUsers
            allUsers = await response.json();

            //masukkan nama-nama pengguna ini ke dalam 12 kotak pilihan (dropdown) tim pelayanan
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
    //ambil setiap ID dropdown dari daftar TIM_SELECT_IDS satu per satu
    Object.values(TIM_SELECT_IDS).forEach(selectId => {
        //cari elemen HTML dropdown berdasarkan ID-nya
        const selectEl = document.getElementById(selectId);

        //kalau elemen tidak ditemukan di halaman, lewati saja
        if (!selectEl) return;

        //kosongkan isi lama dan berikan opsi awal default berupa "-- Pilih --"
        selectEl.innerHTML = '<option value="">-- Pilih --</option>';

        //telusuri setiap data user yang ada
        allUsers.forEach(user => {
            //buat elemen tag <option> baru
            const opt = document.createElement('option');

            //nilai yang dikirim saat dipilih adalah nama lengkap anggota
            opt.value = user.nama_lengkap;
            opt.setAttribute('data-id', user.id_pengguna);

            //teks yang dibaca user di layar juga nama lengkap anggota
            opt.textContent = user.nama_lengkap;

            //tempelkan opsi nama ini ke dalam dropdown
            selectEl.appendChild(opt);
        });

        //cek apakah fitur pencarian dalam dropdown sudah ada
        if (typeof Choices !== 'undefined') {
            if (choicesInstances[selectId]) {
                choicesInstances[selectId].destroy();
            }
            //aktifkan fitur pencarian di dropdown ini agar user bisa mengetik nama anggota dengan mudah
            choicesInstances[selectId] = new Choices(selectEl, {
                searchEnabled: true,  //aktifkan kolom ketik pencarian
                itemSelectText: '',   //hilangkan teks bantuan bawaan "Press to select"
                shouldSort: false     //jangan acak urutan nama yang sudah dimasukkan
            });
        }
    });
}

/**
 * Fungsi bantu untuk mengatur nilai terpilih pada dropdown tim pelayanan dengan dukungan Choices.js
 */
function setSelectValue(selectId, value) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    selectEl.value = value || '';
    if (choicesInstances[selectId]) {
        if (value) {
            choicesInstances[selectId].setChoiceByValue(value);
        } else {
            choicesInstances[selectId].removeActiveItems();
            choicesInstances[selectId].setChoiceByValue('');
        }
    }
}

// ==============================================================================================
// 4. FUNGSI MENYIAPKAN SELURUH EVENT LISTENER (KLIK & SUBMIT)
// ==============================================================================================
/**
 * Memasang pendengar aksi (event listeners) untuk tombol navigasi, filter, dan form
 */
function setupEventListeners() {
    //ambil tombol panah navigasi bulan di kalender
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    //jika tombol 'Bulan Sebelumnya' (<) diklik oleh user
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            //kurangi angka bulan saat ini sebanyak 1 (mundur 1 bulan)
            currentCalendarDate.setDate(1);
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            selectedFilterDate = null;
            //gambar ulang tampilan kalender dan daftar jadwal untuk bulan yang baru
            renderCalendar();
            if (currentView === 'list') renderScheduleList();
        });
    }

    //jika tombol 'Bulan Berikutnya' (>) diklik oleh user
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            //tambah angka bulan saat ini sebanyak 1 (maju 1 bulan)
            currentCalendarDate.setDate(1);
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            selectedFilterDate = null;
            //gambar ulang tampilan kalender dan daftar jadwal untuk bulan yang baru
            renderCalendar();
            if (currentView === 'list') renderScheduleList();
        });
    }

    //ambil tombol hijau "+ Tambah Jadwal" di bagian atas halaman
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    if (btnTambah) {
        //saat diklik, buka form pengisian jadwal baru (null artinya bukan mengedit jadwal lama)
        btnTambah.addEventListener('click', () => {
            openForm(null);
        });
    }

    //ambil tombol ikon tempat sampah merah di header (yang muncul saat form sedang terbuka)
    const btnTrashHeader = document.getElementById('btn-trash-header');
    if (btnTrashHeader) {
        //saat diklik, tangani apakah membatalkan input baru atau menghapus jadwal yang sedang diedit
        btnTrashHeader.addEventListener('click', handleTrashHeaderClick);
    }

    //ambil tombol "Tampilkan Semua Jadwal" pada bar informasi filter tanggal
    const btnResetFilter = document.getElementById('btn-reset-filter');
    if (btnResetFilter) {
        //saat diklik, buang filter tanggal dan tampilkan kembali semua jadwal
        btnResetFilter.addEventListener('click', () => {
            resetDateFilter();
        });
    }

    //Cari semua tombol pilihan kategori di dalam form: Pelayanan, Latihan, atau Event
    const categoryButtons = document.querySelectorAll('.category-pills .btn-category');
    categoryButtons.forEach(btn => {
        //saat salah satu tombol kategori diklik
        btn.addEventListener('click', (e) => {
            //ambil nama kategori yang tersimpan di atribut data-category tombol tersebut
            const category = btn.getAttribute('data-category');
            //terapkan perubahan kategori dan ubah susunan field form sesuai kategorinya
            setCategoryPill(category);
        });
    });

    //ambil elemen form input jadwal
    const formInline = document.getElementById('form-jadwal-inline');
    if (formInline) {
        //ketika tombol simpan pada form ditekan atau formulir di-submit, jalankan fungsi handleFormSubmit
        formInline.addEventListener('submit', handleFormSubmit);
    }
}

// ==============================================================================================
// 5. FUNGSI MENGAMBIL DATA JADWAL 
// ==============================================================================================
/**
 * Mengambil seluruh jadwal dari server, mengurutkannya, lalu menampilkannya ke layar
 */
async function fetchJadwal() {
    //ambil elemen wadah tempat kartu-kartu jadwal ditampilkan
    const listContainer = document.getElementById('schedule-cards-list');

    //jika wadah ada dan kita sedang di mode daftar ('list'), tampilkan animasi loading berputar
    if (listContainer && currentView === 'list') {
        listContainer.innerHTML = `
            <div class="loading-state">
                <i class="ph ph-spinner ph-spin"></i>
                <p>Memuat data jadwal...</p>
            </div>
        `;
    }

    try {
        //kirim permintaan HTTP GET ke endpoint API jadwal
        const response = await fetch('/api/jadwal');

        //jika server mengembalikan status error (bukan 200), lemparkan pesan error
        if (!response.ok) throw new Error('Gagal mengambil data jadwal pelayanan');

        //baca data jawaban dari server dalam bentuk objek JSON
        const result = await response.json();

        //simpan array jadwal ke variabel allJadwal (jika kosong, gunakan array kosong [])
        allJadwal = result.data || [];

        //bersihkan dan seragamkan format tanggal jika ada format jam bawaan database (misal: "2026-06-06T00:00:00Z")
        allJadwal.forEach(j => {
            // Normalisasi atribut skema database baru dan kompatibilitas
            if (!j.tanggal && j.tanggal_pelayanan) j.tanggal = j.tanggal_pelayanan;
            if (!j.judul && j.tema_kotbah) j.judul = j.tema_kotbah;
            if (!j.tujuan && j.tujuan_ringkasan) j.tujuan = j.tujuan_ringkasan;
            const rawTime = j.jam_pelayanan || j.waktu || '17:00';
            j.waktu = rawTime.length >= 5 ? rawTime.substring(0, 5) : rawTime;
            if (!j.id && j.id_jadwal) j.id = String(j.id_jadwal);

            if (j.tanggal && j.tanggal.includes('T')) {
                //ambil hanya bagian tanggalnya saja di depan huruf 'T' (menjadi "2026-06-06")
                j.tanggal = j.tanggal.split('T')[0];
            }
        });

        //urutkan jadwal dari tanggal yang paling dekat (terdahulu) ke tanggal yang paling jauh di masa depan
        allJadwal.sort((a, b) => {
            const dateCompare = new Date(a.tanggal) - new Date(b.tanggal);
            if (dateCompare !== 0) return dateCompare;
            return (a.waktu || '').localeCompare(b.waktu || '');
        });

        //gambar ulang kalender di sisi kiri agar tanggal-tanggal yang ada acaranya diberi tanda titik (dot)
        renderCalendar();

        // Jika halaman dibuka melalui tombol "Edit Pelayan" dari menu Berhalangan (?edit_id=...)
        if (pendingEditIdFromUrl && canManageJadwal) {
            const targetItem = allJadwal.find(j => String(j.id_jadwal || j.id) === String(pendingEditIdFromUrl));
            pendingEditIdFromUrl = null;
            if (targetItem) {
                if (targetItem.tanggal) {
                    const parts = targetItem.tanggal.split('-');
                    if (parts.length === 3) {
                        currentCalendarDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
                    }
                }
                openForm(targetItem);
                return;
            }
        }

        //jika sedang di mode melihat daftar, gambarkan kartu-kartu jadwal di sisi kanan
        if (currentView === 'list') {
            renderScheduleList();
        }

    } catch (error) {
        //kalau terjadi kegagalan jaringan atau server mati, tampilkan pesan error di konsol dan di layar
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
    //ambil elemen teks judul bulan-tahun dan kotak grid tempat tanggal-tanggal diletakkan
    const monthYearText = document.getElementById('month-year-text');
    const datesGrid = document.getElementById('calendar-dates-grid');

    //jika salah satu elemen di atas tidak ditemukan, hentikan fungsi
    if (!monthYearText || !datesGrid) return;

    //dapatkan tahun dan bulan angka (0 = Januari, 11 = Desember) dari state kalender saat ini
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    //perbarui tulisan judul bulan & tahun di atas kalender (contoh: "Juni 2026")
    monthYearText.textContent = `${BULAN_INDONESIA[month]} ${year}`;

    //cari tahu hari apa tanggal 1 pada bulan ini (0 = Minggu, 1 = Senin, dst)
    const firstDayIndex = new Date(year, month, 1).getDay();

    //cari tahu ada berapa total jumlah hari di bulan ini (misal 30 atau 31 hari)
    const totalDays = new Date(year, month + 1, 0).getDate();

    //dapatkan tanggal ril hari ini untuk penandaan visual khusus
    const today = new Date();
    //cek apakah kalender yang lagi dilihat ini adalah bulan & tahun saat ini
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    //jika benar bulan ini, catat angka tanggalnya (misal: 28), jika bukan beri null
    const todayDate = isCurrentMonth ? today.getDate() : null;

    //kumpulkan tanggal-tanggal berapa saja yang memiliki jadwal kegiatan di bulan yang sedang ditampilkan
    const eventDatesInMonth = new Set();
    allJadwal.forEach(j => {
        if (!j.tanggal) return;
        const parts = j.tanggal.split('-');
        if (parts.length === 3) {
            const jYear = parseInt(parts[0], 10);
            const jMonth = parseInt(parts[1], 10) - 1;
            const jDay = parseInt(parts[2], 10);
            //jika tahun dan bulannya cocok dengan yang sedang dilihat user
            if (jYear === year && jMonth === month) {
                //masukkan angka harinya ke dalam Set (supaya tidak ada tanggal duplikat)
                eventDatesInMonth.add(jDay);
            }
        }
    });

    //kosongkan isi grid kalender yang lama sebelum menggambar yang baru
    datesGrid.innerHTML = '';

    //buat kotak sel kosong sebelum tanggal 1 agar posisi hari (Minggu, Senin, dst) sejajar dengan benar
    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-blank-cell';
        datesGrid.appendChild(blank);
    }

    //buat kotak sel tanggal mulai dari tanggal 1 hingga hari terakhir di bulan tersebut
    for (let day = 1; day <= totalDays; day++) {
        //buat elemen kotak tanggal
        const cell = document.createElement('div');
        cell.className = 'date-cell';
        cell.textContent = day;

        //susun format tanggal standar YYYY-MM-DD dengan menambahkan angka 0 di depan jika di bawah 10
        const monthFormatted = String(month + 1).padStart(2, '0');
        const dayFormatted = String(day).padStart(2, '0');
        const dateString = `${year}-${monthFormatted}-${dayFormatted}`;

        //jika tanggal ini adalah hari ini, berikan penanda visual lingkaran khusus ('today')
        if (day === todayDate) {
            cell.classList.add('today');
        }

        //jika pada tanggal ini terdapat jadwal kegiatan, beri tanda titik oranye/kuning ('event-dot')
        if (eventDatesInMonth.has(day)) {
            cell.classList.add('event-dot');
            cell.title = 'Ada jadwal pelayanan';
        }

        //jika tanggal ini sama dengan tanggal yang sedang difilter/dipilih oleh user, beri gaya aktif ('selected')
        if (selectedFilterDate === dateString) {
            cell.classList.add('selected');
        }

        //pasang aksi saat kotak tanggal ini diklik oleh pengguna
        cell.addEventListener('click', () => {
            //jika user sedang membuka form input (tambah / edit)
            if (currentView === 'form') {
                //mengklik tanggal di kalender langsung otomatis mengisi input field tanggal pada formulir!
                document.getElementById('input-tanggal').value = dateString;
                selectedFilterDate = dateString;
                //gambar ulang kalender untuk memindahkan sorotan warna ke tanggal baru ini
                renderCalendar();
            }
            //jika user sedang di mode melihat daftar kartu jadwal
            else {
                //jika user mengklik tanggal yang sebelumnya sudah aktif dipilih, batalkan filternya
                if (selectedFilterDate === dateString) {
                    resetDateFilter();
                } else {
                    //jika mengklik tanggal baru, aktifkan filter untuk tanggal tersebut
                    selectedFilterDate = dateString;
                    renderCalendar();
                    //saring kartu jadwal di sebelah kanan hanya untuk tanggal ini saja
                    renderScheduleList();
                }
            }
        });

        //tempelkan kotak tanggal yang sudah selesai dibuat ke dalam grid kalender
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
    //kosongkan variabel tanggal terpilih
    selectedFilterDate = null;

    //perbarui kalender (menghilangkan warna sorotan pada tanggal yang tadi diklik)
    renderCalendar();

    //tampilkan kembali semua daftar jadwal tanpa filter
    renderScheduleList();
}

// ==============================================================================================
// 8. FUNGSI MEMBUKA FORM TAMBAH ATAU EDIT JADWAL
// ==============================================================================================
/**
 * Mengganti tampilan kanan dari daftar kartu menjadi form input jadwal
 * @param {Object|null} editData - Jika diisi data jadwal, maka menjadi mode edit. jika null, mode tambah baru.
 */
function openForm(editData = null) {
    //ubah status tampilan aktif menjadi 'form'
    currentView = 'form';

    //catat ID jadwal yang mau diedit (kalau tambah baru, nilainya null)
    activeEditId = editData ? editData.id : null;

    //sembunyikan bagian daftar kartu jadwal di kolom kanan
    document.getElementById('schedule-list-section').style.display = 'none';

    //munculkan bagian form input jadwal di kolom kanan
    document.getElementById('schedule-form-section').style.display = 'block';

    //atur tombol aksi di bagian header halaman:
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    const btnTrash = document.getElementById('btn-trash-header');

    //sembunyikan tombol "tambah jadwal" karena form sudah terbuka
    if (btnTambah) btnTambah.style.display = 'none';

    //munculkan tombol ikon tempat sampah merah di header (untuk membatalkan atau menghapus jadwal)
    if (btnTrash) btnTrash.style.display = 'inline-flex';

    //sembunyikan bar info filter tanggal agar tampilan form bersih dan rapi
    const filterBar = document.getElementById('filter-status-bar');
    if (filterBar) filterBar.style.display = 'none';

    //bersihkan seluruh isian form sebelumnya (reset formulir)
    const form = document.getElementById('form-jadwal-inline');
    form.reset();

    //ambil elemen tombol submit hijau di bagian bawah form
    const submitBtn = document.getElementById('btn-submit-form');

    //jika dalam mode edit jadwal (data lama dikirimkan):
    if (editData) {
        //ganti label tombol submit menjadi "Simpan Perubahan"
        submitBtn.textContent = 'Simpan Perubahan';

        //masukkan ID jadwal lama ke input tersembunyi
        document.getElementById('input-jadwal-id').value = editData.id_jadwal || editData.id;

        //pilih tombol pil kategori sesuai data lama (misal: "Pelayanan", "Latihan", atau "Event")
        setCategoryPill(editData.kategori || 'Pelayanan');

        //isi kolom input teks dengan data jadwal yang sudah ada
        document.getElementById('input-tema').value = editData.tema_kotbah || editData.judul || '';
        document.getElementById('input-ringkasan').value = editData.tujuan_ringkasan || editData.tujuan || '';
        document.getElementById('input-pengkotbah').value = editData.pengkotbah || '';
        document.getElementById('input-tanggal').value = editData.tanggal_pelayanan || editData.tanggal || '';
        const rawWaktu = editData.jam_pelayanan || editData.waktu || '17:00';
        document.getElementById('input-waktu').value = rawWaktu.length >= 5 ? rawWaktu.substring(0, 5) : rawWaktu;

        //ambil data penugasan tim pelayanan
        const tim = editData.tim_pelayanan || {};
        if (!tim.usher && tim.usher_1) {
            tim.usher = tim.usher_1;
        }

        //cocokkan setiap posisi pelayanan dan atur nilai dropdown-nya sesuai data lama
        Object.entries(TIM_SELECT_IDS).forEach(([roleKey, selectId]) => {
            setSelectValue(selectId, tim[roleKey] || '');
        });

        //tandai tanggal jadwal ini di kalender
        selectedFilterDate = editData.tanggal_pelayanan || editData.tanggal;
        renderCalendar();
    }
    //jika dalam mode tambah jadwal baru:
    else {
        //beri teks tombol submit "Tambah Jadwal"
        submitBtn.textContent = 'Tambah Jadwal';

        //pastikan input ID jadwal tersembunyi dalam keadaan kosong
        document.getElementById('input-jadwal-id').value = '';

        //tentukan kategori default awal sebagai "Pelayanan"
        setCategoryPill('Pelayanan');

        //kosongkan seluruh pilihan dropdown tim pelayanan
        Object.values(TIM_SELECT_IDS).forEach(selectId => {
            setSelectValue(selectId, '');
        });

        //tentukan tanggal bawaan awal:
        //jika user tadi sedang memilih suatu tanggal di kalender, gunakan tanggal itu
        if (selectedFilterDate) {
            document.getElementById('input-tanggal').value = selectedFilterDate;
        } else {
            //kalau belum memilih tanggal apa pun, cari hari sabtu terdekat secara otomatis
            const d = new Date();
            const dayOfWeek = d.getDay(); // 0 = Minggu, 6 = Sabtu
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
            d.setDate(d.getDate() + (daysUntilSaturday === 0 ? 0 : daysUntilSaturday));

            //formatkan tanggal sabtu tersebut ke format YYYY-MM-DD
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const defaultDate = `${yyyy}-${mm}-${dd}`;

            //pasang ke input tanggal dan sorot di kalender
            document.getElementById('input-tanggal').value = defaultDate;
            selectedFilterDate = defaultDate;
            renderCalendar();
        }

        //tentukan jam default pelaksanaan ibadah, yaitu pukul 17:00 WIB
        document.getElementById('input-waktu').value = '17:00';
    }

    //kembalikan posisi scroll form ke paling atas agar user langsung melihat judul form
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
    //pastikan kategori yang dimasukkan valid, jika tidak ada gunakan default 'Pelayanan'
    const validCategory = categoryName || 'Pelayanan';

    //simpan nilai kategori ke input tersembunyi agar ikut terkirim saat form di-submit
    document.getElementById('input-kategori').value = validCategory;

    //berikan efek visual tombol aktif pada tombol yang sesuai dan matikan efek pada tombol lainnya
    const categoryButtons = document.querySelectorAll('.category-pills .btn-category');
    categoryButtons.forEach(btn => {
        if (btn.getAttribute('data-category') === validCategory) {
            btn.classList.add('active'); //tombol yang dipilih ditandai aktif
        } else {
            btn.classList.remove('active'); //tombol lainnya dinonaktifkan
        }
    });

    //sesuaikan label teks dan sembunyikan/tampilkan field form yang cocok untuk kategori ini
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
    //ambil elemen-elemen label dan input yang akan disesuaikan
    const labelTema = document.getElementById('label-tema');
    const inputTema = document.getElementById('input-tema');
    const labelRingkasan = document.getElementById('label-ringkasan');
    const inputRingkasan = document.getElementById('input-ringkasan');
    const fieldPengkotbah = document.getElementById('field-pengkotbah');
    const inputPengkotbah = document.getElementById('input-pengkotbah');

    //ambil elemen peran tambahan yang hanya dibutuhkan pada ibadah utama (drummer, MCM, sound, usher, dll)
    const extraRoles = document.querySelectorAll('.role-pelayanan-only');

    //jika kategori adalah 'Latihan':
    if (categoryName === 'Latihan') {
        //1.ubah label tema kotbah menjadi "Nama Latihan"
        if (labelTema) labelTema.textContent = 'Nama Latihan';
        if (inputTema) inputTema.placeholder = '';

        //2.ubah label Ringkasan menjadi "Untuk Latihan Ibadah kapan?"
        if (labelRingkasan) labelRingkasan.textContent = 'Untuk Latihan Ibadah kapan?';
        if (inputRingkasan) inputRingkasan.placeholder = '';

        //3.sembunyikan kolom Pengkotbah karena sesi latihan tidak memerlukan pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = 'none';
        if (inputPengkotbah) inputPengkotbah.value = '';

        //4.sembunyikan peran pelayan selain musik inti (hanya menyisakan WL, Singer 1 & 2, Piano, Bass, Gitar)
        extraRoles.forEach(el => {
            el.style.display = 'none';
            const select = el.querySelector('select');
            //jika sedang buat baru, kosongkan pilihan yang disembunyikan
            if (select && currentView === 'form' && !activeEditId) select.value = '';
        });

    }
    //jika kategori adalah 'Event':
    else if (categoryName === 'Event') {
        //1.ubah label menjadi "Nama Event"
        if (labelTema) labelTema.textContent = 'Nama Event';
        if (inputTema) inputTema.placeholder = '';

        //2.ubah label ringkasan menjadi "Tema"
        if (labelRingkasan) labelRingkasan.textContent = 'Tema';
        if (inputRingkasan) inputRingkasan.placeholder = '';

        //3.sembunyikan kolom Pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = 'none';
        if (inputPengkotbah) inputPengkotbah.value = '';

        //4.sembunyikan peran-peran teknis ibadah mingguan
        extraRoles.forEach(el => {
            el.style.display = 'none';
            const select = el.querySelector('select');
            if (select && currentView === 'form' && !activeEditId) select.value = '';
        });

    }
    //jika kategori adalah 'Pelayanan' (ibadah utama / default):
    else {
        //kembalikan label ke format standar ibadah
        if (labelTema) labelTema.textContent = 'Tema Kotbah';
        if (inputTema) inputTema.placeholder = 'Masukkan tema kotbah...';

        if (labelRingkasan) labelRingkasan.textContent = 'Ringkasan / Tujuan';
        if (inputRingkasan) inputRingkasan.placeholder = 'Masukkan ringkasan atau tujuan firman...';

        //tampilkan kembali kolom pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = '';

        //tampilkan seluruh 12 peran tim pelayanan secara lengkap
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
    //ubah status tampilan aktif kembali ke mode 'list'
    currentView = 'list';

    //hapus ID jadwal aktif yang tadi diedit
    activeEditId = null;

    //sembunyikan formulir input
    document.getElementById('schedule-form-section').style.display = 'none';

    //tampilkan kembali wadah daftar kartu jadwal
    document.getElementById('schedule-list-section').style.display = 'block';

    //atur tombol aksi di bagian header:
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    const btnTrash = document.getElementById('btn-trash-header');

    //tampilkan kembali tombol "+ tambah jadwal" jika user memiliki izin
    if (btnTambah && canManageJadwal) btnTambah.style.display = 'inline-flex';

    //sembunyikan tombol ikon tempat sampah merah
    if (btnTrash) btnTrash.style.display = 'none';

    //gambar ulang kartu jadwal untuk memastikan data yang ditampilkan adalah data paling baru
    renderScheduleList();
}

// ==============================================================================================
// 12. FUNGSI MENANGANI KLIK TOMBOL TRASH (BATAL / HAPUS)
// ==============================================================================================
/**
 * Menangani fungsi tombol tempat sampah merah di sudut kanan atas:
 * - Jika sedang edit jadwal: bertindak sebagai tombol HAPUS JADWAL dari database
 * - Jika sedang tambah jadwal baru: bertindak sebagai tombol BATAL dan kembali ke list
 */
async function handleTrashHeaderClick() {
    //jika user sedang mengedit jadwal yang sudah ada di database
    if (activeEditId) {
        //cari data jadwal ini di memori untuk menampilkan judulnya pada kotak konfirmasi
        const item = allJadwal.find(j => String(j.id) === String(activeEditId));
        const judul = item ? item.judul : 'jadwal ini';

        //tanyakan konfirmasi kepada user sebelum menghapus secara permanen
        if (confirm(`Apakah Anda yakin ingin menghapus jadwal:\n"${judul}"?`)) {
            try {
                //kirim permintaan HTTP DELETE ke backend API
                const res = await fetch(`/api/jadwal/${activeEditId}`, { method: 'DELETE' });

                //jika penghapusan gagal, lempar pesan error
                if (!res.ok) throw new Error('Gagal menghapus');

                //ambil kembali daftar jadwal terbaru dari database
                await fetchJadwal();

                //tutup form dan kembali ke tampilan daftar kartu
                closeForm();
            } catch (err) {
                //tampilkan pesan jika terjadi kesalahan
                alert('Gagal menghapus jadwal: ' + err.message);
            }
        }
    }
    //jika user sedang membuat jadwal baru dan ingin membatalkannya
    else {
        //langsung tutup form dan kembali ke daftar kartu
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
    //hentikan perilaku bawaan browser (supaya halaman web tidak me-refresh sendiri)
    e.preventDefault();

    //ambil seluruh nilai yang sudah diketik oleh pengguna di formulir
    const id = document.getElementById('input-jadwal-id').value;
    const kategori = document.getElementById('input-kategori').value || 'Pelayanan';
    const tema_kotbah = document.getElementById('input-tema').value.trim();
    const ringkasan_tujuan = document.getElementById('input-ringkasan').value.trim();
    const pengkotbah = document.getElementById('input-pengkotbah').value.trim();
    const tanggal = document.getElementById('input-tanggal').value;
    const waktu = document.getElementById('input-waktu').value || '17:00';

    //validasi dasar: pastikan Tanggal dan Judul/Tema tidak dibiarkan kosong oleh pengguna
    if (!tanggal || !tema_kotbah) {
        const namaField = kategori === 'Latihan' ? 'Nama Latihan' : (kategori === 'Event' ? 'Nama Event' : 'Tema Kotbah');
        alert(`Tanggal dan ${namaField} wajib diisi!`);
        return;
    }

    //kumpulkan nama-nama pelayan dari ke-12 kotak dropdown
    const tim_pelayanan = {};
    Object.entries(TIM_SELECT_IDS).forEach(([roleKey, selectId]) => {
        const selectEl = document.getElementById(selectId);
        //masukkan nama orang yang dipilih (atau string kosong jika tidak ditugaskan siapa pun)
        tim_pelayanan[roleKey] = selectEl ? selectEl.value : '';
    });

    //bungkus semua data di atas ke dalam satu objek payload JSON yang siap dikirim ke backend
    const payload = {
        kategori,
        // Kolom database baru
        tema_kotbah,
        tujuan_ringkasan: ringkasan_tujuan,
        tanggal_pelayanan: tanggal,
        jam_pelayanan: waktu,
        pengkotbah: (kategori === 'Latihan' || kategori === 'Event') ? '' : pengkotbah,
        tim_pelayanan,
        // Kolom alias untuk backward compatibility
        judul: tema_kotbah,
        tujuan: ringkasan_tujuan,
        ringkasan_tujuan,
        tanggal,
        waktu
    };

    //tentukan apakah aksi ini adalah edit (jika ID ada) atau tambah baru (jika ID kosong)
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/jadwal/${id}` : '/api/jadwal'; //url endpoint API yang dituju
    const method = isEdit ? 'PUT' : 'POST';                 //metode HTTP (PUT untuk edit, POST untuk baru)

    //ambil tombol submit untuk memberikan efek visual sedang memproses
    const submitBtn = document.getElementById('btn-submit-form');
    const originalText = submitBtn.textContent;

    //matikan tombol sementara dan ubah teksnya agar user tidak mengklik berkali-kali
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
        //kirim data ke backend menggunakan fetch API
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        //baca hasil balasan dari server
        const result = await response.json();

        //jika server mengembalikan pesan error, lemparkan pesan tersebut
        if (!response.ok) {
            throw new Error(result.message || result.error || 'Gagal menyimpan jadwal');
        }

        // Jika pengeditan ini berasal dari halaman Berhalangan (Edit Pelayan), tandai otomatis status izin menjadi Selesai
        if (cameFromBerhalangan && berhalanganChatId) {
            try {
                await fetch(`/api/berhalangan/${berhalanganChatId}/selesai`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_penindaklanjut: window.userData ? window.userData.id_pengguna : null
                    })
                });
            } catch (e) {
                console.warn('Gagal memperbarui status selesai berhalangan:', e);
            }
        }

        //ambil data jadwal terbaru dari server agar tampilan langsung sinkron
        await fetchJadwal();

        //tutup form dan kembali ke tampilan daftar kartu
        closeForm();

    } catch (error) {
        //tampilkan pesan peringatan jika terjadi kegagalan menyimpan
        console.error('Error saving jadwal:', error);
        alert(error.message);
    } finally {
        //kembalikan tombol ke keadaan semula (bisa diklik lagi) apa pun hasilnya
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ==============================================================================================
// 14. FUNGSI MERENDER KARTU-KARTU JADWAL
// ==============================================================================================
/**
 * Menggambar seluruh kartu jadwal ke dalam daftar di kolom kanan
 */
function renderScheduleList() {
    //ambil elemen-elemen antarmuka yang akan dimanipulasi
    const listContainer = document.getElementById('schedule-cards-list');
    const badgeCount = document.getElementById('schedule-count-badge');
    const filterStatusBar = document.getElementById('filter-status-bar');
    const filterDateText = document.getElementById('filter-date-text');
    const listTitle = document.getElementById('list-title');

    //jika wadah daftar kartu tidak ditemukan di HTML, hentikan fungsi
    if (!listContainer) return;

    //siapkan data jadwal yang akan ditampilkan sesuai bulan & tahun kalender yang aktif
    const activeYear = currentCalendarDate.getFullYear();
    const activeMonth = currentCalendarDate.getMonth();

    let displayedJadwal = allJadwal.filter(j => {
        if (!j.tanggal) return false;
        const parts = j.tanggal.split('-');
        if (parts.length !== 3) return false;
        const jYear = parseInt(parts[0], 10);
        const jMonth = parseInt(parts[1], 10) - 1;
        return jYear === activeYear && jMonth === activeMonth;
    });

    //pengecekan filter tanggal:
    //jika ada tanggal yang sedang diklik user di kalender
    if (selectedFilterDate) {
        //ambil hanya jadwal yang tanggalnya sama persis dengan tanggal yang diklik
        displayedJadwal = displayedJadwal.filter(j => j.tanggal === selectedFilterDate);

        //tampilkan informasi status filter di atas daftar 
        if (filterStatusBar && filterDateText) {
            filterStatusBar.style.display = 'flex';
            filterDateText.textContent = formatTanggalLengkap(selectedFilterDate);
        }
        //ubah judul daftar menjadi "Jadwal Terpilih"
        if (listTitle) listTitle.textContent = 'Jadwal Terpilih';
    } else {
        //jika tidak ada filter tanggal, sembunyikan bilah status filter
        if (filterStatusBar) filterStatusBar.style.display = 'none';
        //kembalikan judul daftar menjadi "Daftar Pelayanan"
        if (listTitle) listTitle.textContent = 'Daftar Pelayanan';
    }

    //memperbarui jumlah jadwal pada lencana (badge) di atas daftar (contoh: "3 Jadwal")
    if (badgeCount) {
        badgeCount.textContent = `${displayedJadwal.length} Jadwal`;
    }

    //jika tidak ada jadwal untuk ditampilkan (kosong):
    if (displayedJadwal.length === 0) {
        const namaBulanTahun = `${BULAN_INDONESIA[activeMonth]} ${activeYear}`;
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-calendar-x" style="font-size: 3rem; color: #94a3b8;"></i>
                <p style="margin-top: 12px; font-weight: 500; color: #64748b;">
                    ${selectedFilterDate ? 'Tidak ada jadwal pelayanan pada tanggal ini.' : `Belum ada jadwal pelayanan pada bulan ${namaBulanTahun}.`}
                </p>
                ${selectedFilterDate ? `
                    <button class="btn-reset-filter" onclick="resetDateFilter()" style="margin-top: 12px;">
                        Tampilkan Semua Jadwal
                    </button>
                ` : (canManageJadwal ? `
                    <button class="btn-primary" onclick="openForm()" style="margin-top: 15px;">
                        <i class="ph ph-plus-circle"></i> Tambah Jadwal
                    </button>
                ` : '')}
            </div>
        `;
        return;
    }

    //kosongkan wadah dan mulai merender setiap kartu jadwal
    listContainer.innerHTML = '';

    //telusuri setiap data jadwal yang lolos seleksi filter
    displayedJadwal.forEach(item => {
        //buat elemen pembungkus kartu jadwal
        const card = document.createElement('div');
        card.className = 'schedule-card';

        //ubah format tanggal menjadi format lengkap yang enak dibaca (contoh: "Sabtu, 6 Juni 2026")
        const formattedDate = formatTanggalLengkap(item.tanggal);

        //ambil jam waktu pelaksanaan dari data jadwal (contoh: "17:00 WIB")
        const rawWaktu = item.jam_pelayanan || item.waktu || '17:00';
        const cleanWaktu = rawWaktu.length >= 5 ? rawWaktu.substring(0, 5) : rawWaktu;
        const timeDisplay = cleanWaktu ? ` • ${cleanWaktu} WIB` : '';

        //identifikasi jenis kategori jadwal
        const isLatihan = item.kategori === 'Latihan';
        const isEvent = item.kategori === 'Event';
        let badgeKategori = '';
        let cardBodyContent = '';

        //sesuaikan isi tubuh kartu sesuai kategorinya:
        if (isLatihan) {
            //tampilan kartu untuk latihan
            badgeKategori = '• <span style="color:#0284c7;">LATIHAN</span>';
            cardBodyContent = `
                <div class="info-group" style="grid-column: 1 / -1;">
                    <label>UNTUK LATIHAN IBADAH</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
            `;
        } else if (isEvent) {
            //tampilan kartu untuk event khusus
            badgeKategori = '• <span style="color:#0d9488;">EVENT</span>';
            cardBodyContent = `
                <div class="info-group" style="grid-column: 1 / -1;">
                    <label>TEMA EVENT</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
            `;
        } else {
            //tampilan kartu untuk ibadah pelayanan mingguan (standar)
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

        //susun struktur isi HTML kartu jadwal
        card.innerHTML = `
            <div class="card-header">
                <span class="card-date">${formattedDate.toUpperCase()}${timeDisplay} ${badgeKategori}</span>
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

        //pasang aksi klik pada kartu
        card.addEventListener('click', (e) => {
            //jika yang diklik adalah tombol ikon tempat sampah di dalam kartu (Hapus)
            if (e.target.closest('.btn-card-delete')) {
                e.stopPropagation(); //mencegah klik tembus ke kartu utama
                hapusCardJadwal(item.id, item.judul);
                return;
            }

            //jika yang diklik adalah tombol "Edit" di dalam kartu
            if (e.target.closest('.btn-card-edit')) {
                e.stopPropagation(); //mencegah klik tembus ke kartu utama
                openForm(item); //buka form langsung terisi dengan data jadwal ini
                return;
            }

            //jika yang diklik adalah bagian badan kartu atau tombol panah detail
            //pindahkan halaman user ke halaman detail jadwal lengkap
            window.location.href = `/detail-jadwal.html?id=${item.id}`;
        });

        //tempelkan kartu yang sudah rapi ke dalam daftar kartu di halaman
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
    //tampilkan konfirmasi penghapusan agar tidak terhapus tidak sengaja
    if (!confirm(`Apakah Anda yakin ingin menghapus jadwal:\n"${judul}"?`)) {
        return; //batalkan jika user menekan tombol Cancel
    }

    try {
        //kirim permintaan HTTP DELETE ke backend
        const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });

        //jika server mengabarkan gagal hapus, lempar error
        if (!res.ok) throw new Error('Gagal menghapus');

        //refresh data jadwal terbaru dari server
        await fetchJadwal();
    } catch (err) {
        //menampilkan pesan jika terjadi kesalahan
        alert('Gagal menghapus jadwal: ' + err.message);
    }
}

// ==============================================================================================
// 16. FUNGSI BANTUAN FORMAT TANGGAL
// ==============================================================================================
/**
 * Mengubah format tanggal "2026-06-06" menjadi format "Sabtu, 6 Juni 2026"
 * @param {string} dateStr - Format tanggal YYYY-MM-DD
 * @returns {string} - Teks tanggal yang rapi
 */
function formatTanggalLengkap(dateStr) {
    //jika tidak ada data tanggal yang diberikan, kembalikan strip (-)
    if (!dateStr) return '-';

    //memecah string tanggal berdasarkan tanda hubung '-' menjadi [tahun, bulan, tanggal]
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; //kurangi 1 karena indeks bulan di JS dimulai dari 0
        const day = parseInt(parts[2], 10);

        //membuat objek Date dari tahun, bulan, dan hari tersebut
        const dateObj = new Date(year, month, day);

        //memanggil nama hari dan nama bulan dalam Bahasa Indonesia
        const namaHari = HARI_INDONESIA[dateObj.getDay()];
        const namaBulan = BULAN_INDONESIA[month];

        //menggabungkan menjadi kalimat tanggal yang lengkap
        return `${namaHari}, ${day} ${namaBulan} ${year}`;
    }

    //jika format tidak sesuai pecahan 3 bagian, kembalikan apa adanya
    return dateStr;
}

// ==============================================================================================
// 17. FUNGSI BANTUAN PENGAMAN DARI SERANGAN XSS
// ==============================================================================================
/**
 * Mengamankan teks dari karakter berbahaya agar tidak bisa menyisipkan skrip jahat (XSS)
 * @param {string} str - Teks mentah yang akan dibersihkan
 * @returns {string} - Teks aman dengan entitas HTML
 */
function escapeHtml(str) {
    //jika teks kosong atau bukan teks, kembalikan string kosong
    if (!str) return '';

    //mengubah karakter khusus HTML menjadi kode entitas yang tidak bisa dieksekusi browser
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
