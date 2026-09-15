// public/js/jadwal.js

let allJadwal = [];
let allUsers = [];
let currentCalendarDate = new Date();
let selectedFilterDate = null; // format: YYYY-MM-DD
let currentView = 'list'; // 'list' atau 'form'
let activeEditId = null;
let canManageJadwal = false;

// Nama hari dan bulan dalam Bahasa Indonesia
const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Mapping ID select untuk Tim Pelayanan
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
    usher_1: 'select-usher1',
    usher_2: 'select-usher2'
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth & Role
    await initAuthPermissions();

    // 2. Fetch data pengguna untuk dropdown Tim Pelayanan
    await fetchUsers();

    // 3. Setup Seluruh Event Listener
    setupEventListeners();

    // 4. Fetch data jadwal awal
    await fetchJadwal();
});

/**
 * Cek autentikasi dan hak akses role
 */
async function initAuthPermissions() {
    if (window.authReady) {
        await window.authReady;
    }

    const role = window.userData ? window.userData.role : (window.isSuperAdmin ? 'Admin' : 'Guest');
    canManageJadwal = window.isSuperAdmin || role === 'Admin' || role === 'Worship Planner';

    const btnTambah = document.getElementById('btn-tambah-jadwal');
    if (btnTambah && !canManageJadwal) {
        btnTambah.style.display = 'none';
    }
}

/**
 * Fetch data seluruh akun pengguna untuk mengisi dropdown tim pelayanan
 */
async function fetchUsers() {
    try {
        const response = await fetch('/api/akun');
        if (response.ok) {
            allUsers = await response.json();
            populateTimPelayananDropdowns();
        }
    } catch (err) {
        console.warn('Gagal memuat akun pengguna:', err);
    }
}

/**
 * Mengisi 12 dropdown tim pelayanan dengan nama-nama anggota gereja
 */
function populateTimPelayananDropdowns() {
    Object.values(TIM_SELECT_IDS).forEach(selectId => {
        const selectEl = document.getElementById(selectId);
        if (!selectEl) return;

        // Reset dan simpan opsi pertama
        selectEl.innerHTML = '<option value="">-- Pilih --</option>';

        allUsers.forEach(user => {
            const opt = document.createElement('option');
            opt.value = user.nama_lengkap;
            opt.textContent = `${user.nama_lengkap} (${user.role})`;
            selectEl.appendChild(opt);
        });
    });
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Navigasi Kalender
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // Tombol Tambah Jadwal di Header (Buka Form Tampilan B)
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => {
            openForm(null);
        });
    }

    // Tombol Trash Merah di Header
    const btnTrashHeader = document.getElementById('btn-trash-header');
    if (btnTrashHeader) {
        btnTrashHeader.addEventListener('click', handleTrashHeaderClick);
    }

    // Tombol Reset Filter Tanggal
    const btnResetFilter = document.getElementById('btn-reset-filter');
    if (btnResetFilter) {
        btnResetFilter.addEventListener('click', () => {
            resetDateFilter();
        });
    }

    // Tombol Kategori Pills (Pelayanan, Latihan, Event)
    const categoryButtons = document.querySelectorAll('.category-pills .btn-category');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = btn.getAttribute('data-category');
            setCategoryPill(category);
        });
    });

    // Form Submit (Tambah / Simpan Perubahan)
    const formInline = document.getElementById('form-jadwal-inline');
    if (formInline) {
        formInline.addEventListener('submit', handleFormSubmit);
    }
}

/**
 * Fetch jadwal dari backend API
 */
async function fetchJadwal() {
    const listContainer = document.getElementById('schedule-cards-list');
    if (listContainer && currentView === 'list') {
        listContainer.innerHTML = `
            <div class="loading-state">
                <i class="ph ph-spinner ph-spin"></i>
                <p>Memuat data jadwal...</p>
            </div>
        `;
    }

    try {
        const response = await fetch('/api/jadwal');
        if (!response.ok) throw new Error('Gagal mengambil data jadwal pelayanan');

        const result = await response.json();
        allJadwal = result.data || [];

        // Normalisasi tanggal ISO
        allJadwal.forEach(j => {
            if (j.tanggal && j.tanggal.includes('T')) {
                j.tanggal = j.tanggal.split('T')[0];
            }
        });

        // Urutkan berdasarkan tanggal terdekat
        allJadwal.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        renderCalendar();
        if (currentView === 'list') {
            renderScheduleList();
        }

    } catch (error) {
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

/**
 * Render Kalender Interaktif
 */
function renderCalendar() {
    const monthYearText = document.getElementById('month-year-text');
    const datesGrid = document.getElementById('calendar-dates-grid');

    if (!monthYearText || !datesGrid) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    monthYearText.textContent = `${BULAN_INDONESIA[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = isCurrentMonth ? today.getDate() : null;

    // Ambil tanggal-tanggal yang memiliki jadwal di bulan ini
    const eventDatesInMonth = new Set();
    allJadwal.forEach(j => {
        if (!j.tanggal) return;
        const d = new Date(j.tanggal);
        if (d.getFullYear() === year && d.getMonth() === month) {
            eventDatesInMonth.add(d.getDate());
        }
    });

    datesGrid.innerHTML = '';

    // Sel kosong sebelum tanggal 1
    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-blank-cell';
        datesGrid.appendChild(blank);
    }

    // Sel tanggal 1 sampai akhir bulan
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'date-cell';
        cell.textContent = day;

        const monthFormatted = String(month + 1).padStart(2, '0');
        const dayFormatted = String(day).padStart(2, '0');
        const dateString = `${year}-${monthFormatted}-${dayFormatted}`;

        if (day === todayDate) {
            cell.classList.add('today');
        }

        // Tanggal ada jadwal pelayanan
        if (eventDatesInMonth.has(day)) {
            cell.classList.add('event-dot');
            cell.title = 'Ada jadwal pelayanan';
        }

        // Tanggal yang sedang aktif terpilih
        if (selectedFilterDate === dateString) {
            cell.classList.add('selected');
        }

        cell.addEventListener('click', () => {
            if (currentView === 'form') {
                // Di Form View: klik tanggal kalender langsung mengisi input Tanggal!
                document.getElementById('input-tanggal').value = dateString;
                selectedFilterDate = dateString;
                renderCalendar();
            } else {
                // Di List View: klik tanggal kalender memfilter daftar kartu
                if (selectedFilterDate === dateString) {
                    resetDateFilter();
                } else {
                    selectedFilterDate = dateString;
                    renderCalendar();
                    renderScheduleList();
                }
            }
        });

        datesGrid.appendChild(cell);
    }
}

/**
 * Reset filter tanggal
 */
function resetDateFilter() {
    selectedFilterDate = null;
    renderCalendar();
    renderScheduleList();
}

/**
 * Buka Tampilan Form Tambah atau Edit (Tampilan B)
 */
function openForm(editData = null) {
    currentView = 'form';
    activeEditId = editData ? editData.id : null;

    // Toggle container di kolom kanan
    document.getElementById('schedule-list-section').style.display = 'none';
    document.getElementById('schedule-form-section').style.display = 'block';

    // Toggle header actions
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    const btnTrash = document.getElementById('btn-trash-header');
    if (btnTambah) btnTambah.style.display = 'none';
    if (btnTrash) btnTrash.style.display = 'inline-flex';

    // Sembunyikan filter status bar saat di form view
    const filterBar = document.getElementById('filter-status-bar');
    if (filterBar) filterBar.style.display = 'none';

    // Reset isi form
    const form = document.getElementById('form-jadwal-inline');
    form.reset();

    const submitBtn = document.getElementById('btn-submit-form');

    if (editData) {
        submitBtn.textContent = 'Simpan Perubahan';
        document.getElementById('input-jadwal-id').value = editData.id;

        // Set kategori
        setCategoryPill(editData.kategori || 'Pelayanan');

        // Set inputs
        document.getElementById('input-tema').value = editData.judul || '';
        document.getElementById('input-ringkasan').value = editData.tujuan || '';
        document.getElementById('input-pengkotbah').value = editData.pengkotbah || '';
        document.getElementById('input-tanggal').value = editData.tanggal || '';
        document.getElementById('input-waktu').value = editData.waktu || '17:00';

        // Set Tim Pelayanan selects
        const tim = editData.tim_pelayanan || {};
        Object.entries(TIM_SELECT_IDS).forEach(([roleKey, selectId]) => {
            const selectEl = document.getElementById(selectId);
            if (selectEl && tim[roleKey]) {
                selectEl.value = tim[roleKey];
            }
        });

        selectedFilterDate = editData.tanggal;
        renderCalendar();
    } else {
        submitBtn.textContent = 'Tambah Jadwal';
        document.getElementById('input-jadwal-id').value = '';

        // Default kategori Pelayanan
        setCategoryPill('Pelayanan');

        // Default tanggal: tanggal yang dipilih di kalender atau Sabtu terdekat
        if (selectedFilterDate) {
            document.getElementById('input-tanggal').value = selectedFilterDate;
        } else {
            // Hitung Sabtu terdekat
            const d = new Date();
            const dayOfWeek = d.getDay();
            const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
            d.setDate(d.getDate() + (daysUntilSaturday === 0 ? 0 : daysUntilSaturday));
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const defaultDate = `${yyyy}-${mm}-${dd}`;
            document.getElementById('input-tanggal').value = defaultDate;
            selectedFilterDate = defaultDate;
            renderCalendar();
        }

        document.getElementById('input-waktu').value = '17:00';
    }

    // Scroll ke atas form card
    const formCard = document.getElementById('schedule-form-section');
    if (formCard) formCard.scrollTop = 0;
}

/**
 * Set tombol pill kategori yang aktif serta sesuaikan tampilan form
 */
function setCategoryPill(categoryName) {
    const validCategory = categoryName || 'Pelayanan';
    document.getElementById('input-kategori').value = validCategory;
    const categoryButtons = document.querySelectorAll('.category-pills .btn-category');
    categoryButtons.forEach(btn => {
        if (btn.getAttribute('data-category') === validCategory) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    applyCategoryFormLayout(validCategory);
}

/**
 * Mengubah field form secara dinamis sesuai kategori yang dipilih (Pelayanan, Latihan, Event)
 */
function applyCategoryFormLayout(categoryName) {
    const labelTema = document.getElementById('label-tema');
    const inputTema = document.getElementById('input-tema');
    const labelRingkasan = document.getElementById('label-ringkasan');
    const inputRingkasan = document.getElementById('input-ringkasan');
    const fieldPengkotbah = document.getElementById('field-pengkotbah');
    const inputPengkotbah = document.getElementById('input-pengkotbah');
    const extraRoles = document.querySelectorAll('.role-pelayanan-only');

    if (categoryName === 'Latihan') {
        // Tampilan khusus Latihan (sesuai acuan gambar user):
        // 1. Label Tema Kotbah -> "Nama Latihan"
        if (labelTema) labelTema.textContent = 'Nama Latihan';
        if (inputTema) inputTema.placeholder = '';

        // 2. Label Ringkasan/Tujuan -> "Untuk Latihan Ibadah kapan?"
        if (labelRingkasan) labelRingkasan.textContent = 'Untuk Latihan Ibadah kapan?';
        if (inputRingkasan) inputRingkasan.placeholder = '';

        // 3. Sembunyikan field Pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = 'none';
        if (inputPengkotbah) inputPengkotbah.value = '';

        // 4. Sembunyikan Drummer, MCM, Lighting, Soundman, Usher 1, Usher 2 (Hanya 6 peran utama: WL, Singer 1, Singer 2, Pianist, Bassist, Gitaris)
        extraRoles.forEach(el => {
            el.style.display = 'none';
            const select = el.querySelector('select');
            if (select && currentView === 'form' && !activeEditId) select.value = '';
        });

    } else if (categoryName === 'Event') {
        // Tampilan khusus Event (sesuai acuan gambar user):
        // 1. Label -> "Nama Event"
        if (labelTema) labelTema.textContent = 'Nama Event';
        if (inputTema) inputTema.placeholder = '';

        // 2. Label -> "Tema"
        if (labelRingkasan) labelRingkasan.textContent = 'Tema';
        if (inputRingkasan) inputRingkasan.placeholder = '';

        // 3. Sembunyikan field Pengkotbah
        if (fieldPengkotbah) fieldPengkotbah.style.display = 'none';
        if (inputPengkotbah) inputPengkotbah.value = '';

        // 4. Sembunyikan Drummer, MCM, Lighting, Soundman, Usher 1, Usher 2 (Hanya 6 peran utama: WL, Singer 1, Singer 2, Pianist, Bassist, Gitaris)
        extraRoles.forEach(el => {
            el.style.display = 'none';
            const select = el.querySelector('select');
            if (select && currentView === 'form' && !activeEditId) select.value = '';
        });

    } else {
        // Pelayanan (Default)
        if (labelTema) labelTema.textContent = 'Tema Kotbah';
        if (inputTema) inputTema.placeholder = 'Masukkan tema kotbah...';

        if (labelRingkasan) labelRingkasan.textContent = 'Ringkasan / Tujuan';
        if (inputRingkasan) inputRingkasan.placeholder = 'Masukkan ringkasan atau tujuan firman...';

        if (fieldPengkotbah) fieldPengkotbah.style.display = '';

        extraRoles.forEach(el => el.style.display = '');
    }
}

/**
 * Kembali ke Tampilan List (Tampilan A)
 */
function closeForm() {
    currentView = 'list';
    activeEditId = null;

    document.getElementById('schedule-form-section').style.display = 'none';
    document.getElementById('schedule-list-section').style.display = 'block';

    const btnTambah = document.getElementById('btn-tambah-jadwal');
    const btnTrash = document.getElementById('btn-trash-header');
    if (btnTambah && canManageJadwal) btnTambah.style.display = 'inline-flex';
    if (btnTrash) btnTrash.style.display = 'none';

    renderScheduleList();
}

/**
 * Handle klik tombol trash merah di header saat di Form View
 */
async function handleTrashHeaderClick() {
    if (activeEditId) {
        // Sedang mode edit -> konfirmasi hapus jadwal
        const item = allJadwal.find(j => String(j.id) === String(activeEditId));
        const judul = item ? item.judul : 'jadwal ini';

        if (confirm(`Apakah Anda yakin ingin menghapus jadwal:\n"${judul}"?`)) {
            try {
                const res = await fetch(`/api/jadwal/${activeEditId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Gagal menghapus');
                await fetchJadwal();
                closeForm();
            } catch (err) {
                alert('Gagal menghapus jadwal: ' + err.message);
            }
        }
    } else {
        // Sedang mode tambah baru -> batalkan dan kembali ke list
        closeForm();
    }
}

/**
 * Handle submit form jadwal
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('input-jadwal-id').value;
    const kategori = document.getElementById('input-kategori').value || 'Pelayanan';
    const tema_kotbah = document.getElementById('input-tema').value.trim();
    const ringkasan_tujuan = document.getElementById('input-ringkasan').value.trim();
    const pengkotbah = document.getElementById('input-pengkotbah').value.trim();
    const tanggal = document.getElementById('input-tanggal').value;
    const waktu = document.getElementById('input-waktu').value || '17:00';

    if (!tanggal || !tema_kotbah) {
        const namaField = kategori === 'Latihan' ? 'Nama Latihan' : (kategori === 'Event' ? 'Nama Event' : 'Tema Kotbah');
        alert(`Tanggal dan ${namaField} wajib diisi!`);
        return;
    }

    // Kumpulkan data Tim Pelayanan dari dropdown
    const tim_pelayanan = {};
    Object.entries(TIM_SELECT_IDS).forEach(([roleKey, selectId]) => {
        const selectEl = document.getElementById(selectId);
        tim_pelayanan[roleKey] = selectEl ? selectEl.value : '';
    });

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

    const isEdit = Boolean(id);
    const url = isEdit ? `/api/jadwal/${id}` : '/api/jadwal';
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = document.getElementById('btn-submit-form');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || result.error || 'Gagal menyimpan jadwal');
        }

        await fetchJadwal();
        closeForm();

    } catch (error) {
        console.error('Error saving jadwal:', error);
        alert(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * Render Kartu-Kartu Jadwal (Tampilan List)
 */
function renderScheduleList() {
    const listContainer = document.getElementById('schedule-cards-list');
    const badgeCount = document.getElementById('schedule-count-badge');
    const filterStatusBar = document.getElementById('filter-status-bar');
    const filterDateText = document.getElementById('filter-date-text');
    const listTitle = document.getElementById('list-title');

    if (!listContainer) return;

    let displayedJadwal = allJadwal;
    if (selectedFilterDate) {
        displayedJadwal = allJadwal.filter(j => j.tanggal === selectedFilterDate);
        if (filterStatusBar && filterDateText) {
            filterStatusBar.style.display = 'flex';
            filterDateText.textContent = formatTanggalLengkap(selectedFilterDate);
        }
        if (listTitle) listTitle.textContent = 'Jadwal Terpilih';
    } else {
        if (filterStatusBar) filterStatusBar.style.display = 'none';
        if (listTitle) listTitle.textContent = 'Daftar Pelayanan';
    }

    if (badgeCount) {
        badgeCount.textContent = `${displayedJadwal.length} Jadwal`;
    }

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

    listContainer.innerHTML = '';
    displayedJadwal.forEach(item => {
        const card = document.createElement('div');
        card.className = 'schedule-card';

        const formattedDate = formatTanggalLengkap(item.tanggal);

        const isLatihan = item.kategori === 'Latihan';
        const isEvent = item.kategori === 'Event';
        let badgeKategori = '';
        let cardBodyContent = '';

        if (isLatihan) {
            badgeKategori = '• <span style="color:#0284c7;">LATIHAN</span>';
            cardBodyContent = `
                <div class="info-group" style="grid-column: 1 / -1;">
                    <label>UNTUK LATIHAN IBADAH</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
            `;
        } else if (isEvent) {
            badgeKategori = '• <span style="color:#0d9488;">EVENT</span>';
            cardBodyContent = `
                <div class="info-group" style="grid-column: 1 / -1;">
                    <label>TEMA EVENT</label>
                    <p>${escapeHtml(item.tujuan || '-')}</p>
                </div>
            `;
        } else {
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

        // Klik seluruh kartu atau tombol detail -> Buka Form Edit!
        card.addEventListener('click', (e) => {
            // Jangan trigger jika klik tombol hapus
            if (e.target.closest('.btn-card-delete')) {
                e.stopPropagation();
                hapusCardJadwal(item.id, item.judul);
                return;
            }
            openForm(item);
        });

        listContainer.appendChild(card);
    });
}

/**
 * Hapus jadwal dari kartu list
 */
async function hapusCardJadwal(id, judul) {
    if (!confirm(`Apakah Anda yakin ingin menghapus jadwal:\n"${judul}"?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus');
        await fetchJadwal();
    } catch (err) {
        alert('Gagal menghapus jadwal: ' + err.message);
    }
}

/**
 * Format tanggal YYYY-MM-DD ke format: "Sabtu, 6 Juni 2026"
 */
function formatTanggalLengkap(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);

        const namaHari = HARI_INDONESIA[dateObj.getDay()];
        const namaBulan = BULAN_INDONESIA[month];
        return `${namaHari}, ${day} ${namaBulan} ${year}`;
    }
    return dateStr;
}

/**
 * Helper escape HTML
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
