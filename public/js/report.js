// file logika untuk halaman report (rekap pelayanan & rekap penggunaan lagu)

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// daftar 10 kolom peran pelayanan yang sesuai sama struktur jadwal di sistem
const ROLE_COLUMNS = [
    { key: 'wl', label: 'WL' },
    { key: 'singer', label: 'Singer' },
    { key: 'pianist', label: 'Pianis' },
    { key: 'bassist', label: 'Bassist' },
    { key: 'gitaris', label: 'Gitaris' },
    { key: 'drummer', label: 'Drummer' },
    { key: 'mcm', label: 'MCM' },
    { key: 'lighting', label: 'Lighting' },
    { key: 'soundman', label: 'Soundman' },
    { key: 'usher', label: 'Usher' }
];

// variabel global buat nyimpen data jadwal, lagu, dan pengaturan filter yang lagi aktif
let allSchedules = [];
let allSongsMaster = [];
let activeTab = 'pelayanan';      // tab yang lagi dibuka: 'pelayanan' atau 'lagu'
let filterMode = 'range';         // mode filter: 'range' (rentang tanggal) atau 'yearly' (tahunan)
let appliedStartDate = '';        // batas awal tanggal format yyyy-mm-dd
let appliedEndDate = '';          // batas akhir tanggal format yyyy-mm-dd
let appliedYear = new Date().getFullYear();

let pelayanRowsData = [];
let laguRowsData = [];
let pelayanSortDesc = true;
let laguSortDesc = true;

// pas halaman html selesai dimuat
document.addEventListener('DOMContentLoaded', async () => {
    // tunggu pengecekan login selesai dulu
    if (window.authReady) {
        await window.authReady;
    }

    // cek hak akses: halaman report cuma boleh dibuka sama admin dan worship planner
    const role = window.userData ? (window.userData.role || '').trim().toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    const canAccessReport = window.isSuperAdmin || role === 'admin' || role === 'worship planner' || role === 'wp';
    if (!canAccessReport) {
        window.location.href = '/dashboard';
        return;
    }

    initDefaultPeriod();
    setupReportInteractions();
    await loadReportData();
});

// fungsi buat ngatur periode tanggal awal pas halaman baru dibuka (1 jan sampai 31 des tahun ini)
function initDefaultPeriod() {
    const now = new Date();
    const currentYear = now.getFullYear();
    appliedYear = currentYear;

    // set default rentang tanggal dari awal tahun sampai akhir tahun supaya semua jadwal tahun ini langsung kelihatan
    appliedStartDate = `${currentYear}-01-01`;
    appliedEndDate = `${currentYear}-12-31`;

    const inputStart = document.getElementById('input-date-start');
    const inputEnd = document.getElementById('input-date-end');
    if (inputStart) inputStart.value = appliedStartDate;
    if (inputEnd) inputEnd.value = appliedEndDate;

    populateYearDropdown([currentYear]);
}

// fungsi buat ngisi pilihan tahun di dropdown mode tahunan sesuai tahun jadwal yang ada di database
function populateYearDropdown(yearsList = []) {
    const selectYear = document.getElementById('select-report-year');
    const yearHint = document.getElementById('year-range-hint');
    if (!selectYear) return;

    const currentYear = new Date().getFullYear();
    const yearSet = new Set([currentYear - 1, currentYear, currentYear + 1, ...yearsList]);
    const sortedYears = Array.from(yearSet).filter(Boolean).sort((a, b) => b - a);

    selectYear.innerHTML = sortedYears
        .map(y => `<option value="${y}" ${Number(y) === Number(appliedYear) ? 'selected' : ''}>${y}</option>`)
        .join('');

    if (yearHint) {
        yearHint.textContent = `1 Jan – 31 Des ${appliedYear}`;
    }
}

// fungsi buat masang semua aksi klik tombol tab, mode periode, tombol tampilkan, kolom cari, dan urutan tabel
function setupReportInteractions() {
    // 1. pindah tampilan antara tab pelayanan dan tab lagu
    const tabBtns = document.querySelectorAll('.report-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.getAttribute('data-tab') || 'pelayanan';

            const panelPelayanan = document.getElementById('panel-report-pelayanan');
            const panelLagu = document.getElementById('panel-report-lagu');
            if (panelPelayanan) panelPelayanan.style.display = activeTab === 'pelayanan' ? 'block' : 'none';
            if (panelLagu) panelLagu.style.display = activeTab === 'lagu' ? 'block' : 'none';
        });
    });

    // 2. ganti mode filter antara rentang tanggal atau tahunan
    const modeBtns = document.querySelectorAll('.mode-btn');
    const rangeWrapper = document.getElementById('range-inputs-wrapper');
    const yearWrapper = document.getElementById('year-inputs-wrapper');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterMode = btn.getAttribute('data-mode') || 'range';

            if (rangeWrapper) rangeWrapper.style.display = filterMode === 'range' ? 'flex' : 'none';
            if (yearWrapper) yearWrapper.style.display = filterMode === 'yearly' ? 'flex' : 'none';
        });
    });

    // 3. kalau pilihan tahun diubah, ganti juga tulisan keterangan 1 jan - 31 des di sebelahnya
    const selectYear = document.getElementById('select-report-year');
    const yearHint = document.getElementById('year-range-hint');
    if (selectYear) {
        selectYear.addEventListener('change', () => {
            if (yearHint) {
                yearHint.textContent = `1 Jan – 31 Des ${selectYear.value}`;
            }
        });
    }

    // 4. pas tombol tampilkan report diklik, jalankan ulang filter dan hitungan
    const btnTampilkan = document.getElementById('btn-tampilkan-report');
    if (btnTampilkan) {
        btnTampilkan.addEventListener('click', () => {
            applyFilterAndCompute();
        });
    }

    // 5. fitur pencarian langsung (live search) pas user ngetik nama pelayan atau judul lagu
    const searchPelayan = document.getElementById('search-pelayan-input');
    if (searchPelayan) {
        searchPelayan.addEventListener('input', () => {
            renderPelayananTable();
        });
    }

    const searchLagu = document.getElementById('search-lagu-input');
    if (searchLagu) {
        searchLagu.addEventListener('input', () => {
            renderLaguTable();
        });
    }

    // 6. fitur klik judul kolom total / jumlah dipakai buat membalik urutan terbesar ke terkecil atau sebaliknya
    const sortPelayanBtn = document.getElementById('sort-pelayan-total');
    if (sortPelayanBtn) {
        sortPelayanBtn.addEventListener('click', () => {
            pelayanSortDesc = !pelayanSortDesc;
            const ind = document.getElementById('sort-pelayan-indicator');
            if (ind) ind.innerHTML = pelayanSortDesc ? '&darr;' : '&uarr;';
            renderPelayananTable();
        });
    }

    const sortLaguBtn = document.getElementById('sort-lagu-count');
    if (sortLaguBtn) {
        sortLaguBtn.addEventListener('click', () => {
            laguSortDesc = !laguSortDesc;
            const ind = document.getElementById('sort-lagu-indicator');
            if (ind) ind.innerHTML = laguSortDesc ? '&darr;' : '&uarr;';
            renderLaguTable();
        });
    }
}

// fungsi buat narik semua data jadwal dan data lagu dari server backend
async function loadReportData() {
    try {
        const [resJadwal, resLagu] = await Promise.all([
            fetch('/api/jadwal'),
            fetch('/api/lagu').catch(() => null)
        ]);

        if (!resJadwal.ok) throw new Error('Gagal mengambil data jadwal dari server');
        const jadwalJson = await resJadwal.json();
        allSchedules = Array.isArray(jadwalJson.data) ? jadwalJson.data : [];

        if (resLagu && resLagu.ok) {
            const laguJson = await resLagu.json();
            allSongsMaster = Array.isArray(laguJson.data) ? laguJson.data : [];
        }

        // kumpulin tahun apa aja yang ada di data jadwal buat dimasukin ke pilihan dropdown tahun
        const scheduleYears = [];
        allSchedules.forEach(j => {
            const cleanDate = extractCleanDate(j.tanggal_pelayanan || j.tanggal);
            if (cleanDate) {
                const yr = parseInt(cleanDate.split('-')[0], 10);
                if (!isNaN(yr)) scheduleYears.push(yr);
            }
        });
        populateYearDropdown(scheduleYears);

        applyFilterAndCompute();
    } catch (error) {
        console.error('Error loading report data:', error);
        const tbodyPelayanan = document.getElementById('tbody-report-pelayanan');
        const tbodyLagu = document.getElementById('tbody-report-lagu');
        if (tbodyPelayanan) {
            tbodyPelayanan.innerHTML = `<tr><td colspan="12" class="empty-table-cell">Gagal memuat data: ${escapeHtml(error.message)}</td></tr>`;
        }
        if (tbodyLagu) {
            tbodyLagu.innerHTML = `<tr><td colspan="4" class="empty-table-cell">Gagal memuat data: ${escapeHtml(error.message)}</td></tr>`;
        }
    }
}

// fungsi buat baca tanggal filter yang dipilih, nyaring jadwalnya, terus ngitung report pelayanan & lagu
function applyFilterAndCompute() {
    const inputStart = document.getElementById('input-date-start');
    const inputEnd = document.getElementById('input-date-end');
    const selectYear = document.getElementById('select-report-year');
    const activePeriodLabel = document.getElementById('active-period-label');

    if (filterMode === 'yearly') {
        appliedYear = selectYear && selectYear.value ? parseInt(selectYear.value, 10) : new Date().getFullYear();
        appliedStartDate = `${appliedYear}-01-01`;
        appliedEndDate = `${appliedYear}-12-31`;
        if (activePeriodLabel) {
            activePeriodLabel.textContent = `Periode aktif: Tahun ${appliedYear}`;
        }
    } else {
        let startVal = inputStart ? inputStart.value : appliedStartDate;
        let endVal = inputEnd ? inputEnd.value : appliedEndDate;

        if (startVal && endVal && startVal > endVal) {
            // tukar otomatis kalau user masukin tanggal awal yang lebih besar dari tanggal akhir
            const temp = startVal;
            startVal = endVal;
            endVal = temp;
            if (inputStart) inputStart.value = startVal;
            if (inputEnd) inputEnd.value = endVal;
        }

        appliedStartDate = startVal || `${new Date().getFullYear()}-01-01`;
        appliedEndDate = endVal || `${new Date().getFullYear()}-12-31`;

        if (activePeriodLabel) {
            activePeriodLabel.textContent = `Periode aktif: ${formatRangeLabel(appliedStartDate, appliedEndDate)}`;
        }
    }

    // ambil jadwal yang tanggalnya masuk di dalam rentang tanggal awal sampai tanggal akhir
    const filteredSchedules = allSchedules.filter(j => {
        const d = extractCleanDate(j.tanggal_pelayanan || j.tanggal);
        if (!d) return false;
        return d >= appliedStartDate && d <= appliedEndDate;
    });

    computePelayananReport(filteredSchedules);
    computeLaguReport(filteredSchedules);
}

// fungsi bantu buat nyamain nama peran dari database supaya masuk ke salah satu dari 10 kolom tabel
function mapRoleToColumnKey(rawRole) {
    if (!rawRole) return null;
    const clean = String(rawRole).toLowerCase().trim().replace(/[\s-]+/g, '_');

    if (clean === 'wl' || clean === 'worship_leader') return 'wl';
    if (clean === 'singer' || clean === 'singer_1' || clean === 'singer_2' || clean === 'singer1' || clean === 'singer2') return 'singer';
    if (clean === 'pianist' || clean === 'pianis' || clean === 'keyboard' || clean === 'keyboardist') return 'pianist';
    if (clean === 'bassist' || clean === 'bass') return 'bassist';
    if (clean === 'gitaris' || clean === 'gitar' || clean === 'guitarist') return 'gitaris';
    if (clean === 'drummer' || clean === 'drum') return 'drummer';
    if (clean === 'mcm' || clean === 'multimedia') return 'mcm';
    if (clean === 'lighting') return 'lighting';
    if (clean === 'soundman' || clean === 'sound' || clean === 'sound_engineer') return 'soundman';
    if (clean === 'usher' || clean === 'usher_1' || clean === 'usher_2' || clean === 'usher1' || clean === 'usher2') return 'usher';
    return null;
}

// fungsi buat ngitung berapa kali tiap pelayan bertugas di masing-masing peran selama periode terpilih
function computePelayananReport(schedules) {
    // wadah map buat nyimpen data per pelayan (kuncinya pakai nama huruf kecil biar ga dobel)
    const servantMap = new Map();
    // wadah set buat nyatet peran apa aja yang ada petugasnya di periode ini
    const activeRolesSet = new Set();
    // variabel buat ngitung total seluruh penugasan dari semua pelayan
    let grandTotalAssignments = 0;

    // fungsi di dalam buat nambahin 1 hitungan tugas ke seorang pelayan pada peran tertentu
    function addAssignment(rawName, rawRole) {
        // bersihin spasi di ujung nama, kalau namanya kosong atau cuma tanda strip lewati aja
        const name = (rawName || '').trim();
        if (!name || name === '-') return;
        // cek peran ini masuk ke kolom tabel yang mana (misal singer_1 masuk ke kolom singer)
        const colKey = mapRoleToColumnKey(rawRole);
        if (!colKey) return;

        // ubah nama jadi huruf kecil semua buat jadi kunci pencarian di servantMap
        const mapKey = name.toLowerCase();
        // kalau nama pelayan ini belum pernah dicatat sebelumnya, buatkan data awal dengan nilai 0 di semua peran
        if (!servantMap.has(mapKey)) {
            const initialCounts = {};
            ROLE_COLUMNS.forEach(c => { initialCounts[c.key] = 0; });
            servantMap.set(mapKey, {
                nama: name,
                counts: initialCounts,
                total: 0
            });
        }

        // ambil data pelayan tersebut, lalu tambahin 1 di kolom perannya, tambahin 1 di total pribadinya, dan tambahin 1 di total keseluruhan
        const entry = servantMap.get(mapKey);
        entry.counts[colKey] = (entry.counts[colKey] || 0) + 1;
        entry.total += 1;
        grandTotalAssignments += 1;
        // tandai kalau peran ini sudah pernah terisi minimal 1 kali
        activeRolesSet.add(colKey);
    }

    // periksa satu per satu jadwal yang masuk dalam periode terpilih
    schedules.forEach(j => {
        // kalau jadwal punya daftar petugas dari tabel jadwal_tugas, hitung setiap petugas beserta perannya
        if (Array.isArray(j.petugas) && j.petugas.length > 0) {
            j.petugas.forEach(p => {
                addAssignment(p.nama_lengkap, p.role_key || p.peran);
            });
        } else if (j.tim_pelayanan && typeof j.tim_pelayanan === 'object') {
            // cadangan kalau data petugas diambil dari objek tim_pelayanan
            Object.entries(j.tim_pelayanan).forEach(([roleKey, personName]) => {
                addAssignment(personName, roleKey);
            });
        }
    });

    // ubah kumpulan data pelayan dari map menjadi array biasa supaya gampang diurutkan dan ditampilkan ke tabel
    pelayanRowsData = Array.from(servantMap.values());

    // ambil elemen 3 kartu angka statistik di bagian atas tab pelayanan
    const elPelayanCount = document.getElementById('stat-pelayan-terlibat');
    const elTotalPenugasan = document.getElementById('stat-total-penugasan');
    const elPeranCount = document.getElementById('stat-peran-pelayanan');

    // tampilkan jumlah pelayan yang terlibat dan total penugasan ke kartu statistik
    if (elPelayanCount) elPelayanCount.textContent = pelayanRowsData.length;
    if (elTotalPenugasan) elTotalPenugasan.textContent = grandTotalAssignments;
    if (elPeranCount) {
        // tampilkan berapa jenis peran pelayanan yang aktif terisi di periode ini (kalau kosong tampilkan 10 peran)
        elPeranCount.textContent = activeRolesSet.size > 0 ? activeRolesSet.size : ROLE_COLUMNS.length;
    }

    // gambar baris-baris data pelayan ke dalam tabel html
    renderPelayananTable();
}

// fungsi buat nampilin baris data pelayan ke tabel rekap pelayanan sesuai pencarian dan urutan total
function renderPelayananTable() {
    // ambil elemen isi tabel, bagian footer bawah tabel, dan kotak ketik pencarian nama pelayan
    const tbody = document.getElementById('tbody-report-pelayanan');
    const footerInfo = document.getElementById('footer-pelayan-info');
    const footerTotal = document.getElementById('footer-pelayan-total');
    const searchInput = document.getElementById('search-pelayan-input');

    if (!tbody) return;

    // baca teks yang diketik user di kotak pencarian, lalu saring nama pelayan yang cocok aja
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filtered = pelayanRowsData.filter(item =>
        !query || item.nama.toLowerCase().includes(query)
    );

    // urutkan daftar pelayan berdasarkan angka total tugas (dari terbanyak ke paling sedikit atau sebaliknya)
    filtered.sort((a, b) => {
        if (b.total !== a.total) {
            return pelayanSortDesc ? (b.total - a.total) : (a.total - b.total);
        }
        // kalau jumlah total tugasnya sama persis, urutkan sesuai abjad nama pelayan
        return a.nama.localeCompare(b.nama, 'id');
    });

    // jumlahkan seluruh angka total tugas dari pelayan yang sedang tampil di tabel
    const displayedTotal = filtered.reduce((acc, cur) => acc + cur.total, 0);

    // perbarui tulisan jumlah pelayan dan angka total penugasan di baris biru paling bawah tabel (footer)
    if (footerInfo) {
        footerInfo.innerHTML = `${filtered.length} pelayan &bull; Total periode terpilih`;
    }
    if (footerTotal) {
        footerTotal.textContent = displayedTotal;
    }

    // kalau tidak ada data pelayan yang ditemukan, tampilkan pesan kosong di tengah tabel
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="empty-table-cell">
                    ${query ? 'Tidak ada nama pelayan yang cocok dengan pencarian.' : 'Belum ada data penugasan pelayanan pada periode ini.'}
                </td>
            </tr>
        `;
        return;
    }

    // susun baris html (tr dan td) untuk setiap pelayan beserta angka tugasnya di ke-10 kolom peran
    tbody.innerHTML = filtered.map(row => {
        const roleCellsHtml = ROLE_COLUMNS.map(col => {
            const val = row.counts[col.key] || 0;
            // kalau pelayan pernah bertugas di peran ini, tampilkan angkanya
            if (val > 0) {
                return `<td class="col-role">${val}</td>`;
            }
            // kalau nilainya 0 (belum pernah bertugas di peran ini), tampilkan tanda strip panjang
            return `<td class="col-role empty-dash">&mdash;</td>`;
        }).join('');

        return `
            <tr>
                <td class="col-name">${escapeHtml(row.nama)}</td>
                ${roleCellsHtml}
                <td class="col-total">${row.total}</td>
            </tr>
        `;
    }).join('');
}

// fungsi buat ngitung berapa kali setiap lagu dipakai dan kapan terakhir kali dibawakan pada periode terpilih
function computeLaguReport(schedules) {
    // wadah map buat nyimpen hitungan pemakaian per lagu dan kamus judul lagu dari master bank lagu
    const songUsageMap = new Map();
    const masterTitleById = new Map();

    // simpan pasangan id_lagu dan judul_lagu dari bank lagu buat cadangan kalau di jadwal cuma tersimpan id-nya
    allSongsMaster.forEach(s => {
        const id = s.id_lagu || s.id;
        const title = (s.judul_lagu || s.judul || '').trim();
        if (id && title) masterTitleById.set(String(id), title);
    });

    // variabel buat ngitung total keseluruhan lagu yang dipakai di semua jadwal pada periode ini
    let totalPemakaian = 0;

    // telusuri satu per satu jadwal ibadah yang masuk dalam periode terpilih
    schedules.forEach(j => {
        // ambil tanggal bersih jadwal ini (format yyyy-mm-dd) dan daftar setlist lagunya
        const scheduleDate = extractCleanDate(j.tanggal_pelayanan || j.tanggal);
        const songs = Array.isArray(j.daftar_lagu) ? j.daftar_lagu : [];

        // cek setiap lagu yang ada di dalam jadwal tersebut
        songs.forEach(songItem => {
            const rawId = songItem.id_lagu || songItem.id;
            const fallbackTitle = masterTitleById.get(String(rawId)) || '';
            const title = (songItem.judul_lagu || songItem.judul || fallbackTitle || '').trim();
            // kalau judul lagu kosong, lewati aja
            if (!title) return;

            // gunakan id_lagu (atau judul lagu huruf kecil) sebagai kunci unik supaya lagu yang sama tergabung hitungannya
            const key = rawId ? `id_${rawId}` : `title_${title.toLowerCase()}`;
            if (!songUsageMap.has(key)) {
                songUsageMap.set(key, {
                    id_lagu: rawId || null,
                    judul: title,
                    count: 0,
                    lastUsedDate: ''
                });
            }

            // tambahin 1 ke jumlah pemakaian lagu ini
            const entry = songUsageMap.get(key);
            entry.count += 1;
            // kalau tanggal jadwal ini lebih baru dibanding tanggal terakhir dipakai yang tercatat, perbarui tanggalnya
            if (scheduleDate && (!entry.lastUsedDate || scheduleDate > entry.lastUsedDate)) {
                entry.lastUsedDate = scheduleDate;
            }
            // tambahin 1 ke total seluruh pemakaian lagu
            totalPemakaian += 1;
        });
    });

    // ubah data lagu dari map menjadi array supaya siap diurutkan dan ditampilkan ke tabel
    laguRowsData = Array.from(songUsageMap.values());

    // ambil elemen 3 kartu angka statistik di bagian atas tab lagu
    const elLaguDigunakan = document.getElementById('stat-lagu-digunakan');
    const elTotalPemakaian = document.getElementById('stat-total-pemakaian');
    const elJadwalIbadah = document.getElementById('stat-jadwal-ibadah');

    // tampilkan jumlah lagu unik yang dipakai, total pemakaian lagu, dan jumlah jadwal ibadah pada periode ini
    if (elLaguDigunakan) elLaguDigunakan.textContent = laguRowsData.length;
    if (elTotalPemakaian) elTotalPemakaian.textContent = totalPemakaian;
    if (elJadwalIbadah) elJadwalIbadah.textContent = schedules.length;

    // gambar baris-baris data lagu ke dalam tabel html
    renderLaguTable();
}

// fungsi buat nampilin baris data lagu ke tabel rekap penggunaan lagu sesuai pencarian dan urutan jumlah dipakai
function renderLaguTable() {
    // ambil elemen isi tabel lagu, bagian footer bawah tabel, dan kotak ketik pencarian judul lagu
    const tbody = document.getElementById('tbody-report-lagu');
    const footerInfo = document.getElementById('footer-lagu-info');
    const footerTotal = document.getElementById('footer-lagu-total');
    const searchInput = document.getElementById('search-lagu-input');

    if (!tbody) return;

    // baca kata kunci pencarian yang diketik user, lalu saring lagu yang judulnya cocok aja
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filtered = laguRowsData.filter(item =>
        !query || item.judul.toLowerCase().includes(query)
    );

    // urutkan lagu berdasarkan jumlah dipakai (dari yang paling sering dipakai ke paling jarang atau sebaliknya)
    filtered.sort((a, b) => {
        if (b.count !== a.count) {
            return laguSortDesc ? (b.count - a.count) : (a.count - b.count);
        }
        // kalau jumlah dipakainya sama, urutkan dari tanggal terakhir dipakai yang paling baru
        if (b.lastUsedDate !== a.lastUsedDate) {
            return (b.lastUsedDate || '').localeCompare(a.lastUsedDate || '');
        }
        // kalau tanggalnya masih sama juga, urutkan sesuai abjad judul lagu
        return a.judul.localeCompare(b.judul, 'id');
    });

    // hitung total pemakaian dari lagu-lagu yang sedang ditampilkan di tabel
    const displayedTotalUses = filtered.reduce((acc, cur) => acc + cur.count, 0);

    // perbarui keterangan jumlah lagu dan total berapa kali dipakai pada baris footer di bawah tabel
    if (footerInfo) {
        footerInfo.innerHTML = `${filtered.length} lagu &bull; Total periode terpilih`;
    }
    if (footerTotal) {
        footerTotal.textContent = `${displayedTotalUses} kali`;
    }

    // kalau belum ada lagu yang dipakai atau pencarian tidak ketemu, tampilkan pesan kosong
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-table-cell">
                    ${query ? 'Tidak ada judul lagu yang cocok dengan pencarian.' : 'Belum ada data penggunaan lagu pada periode ini.'}
                </td>
            </tr>
        `;
        return;
    }

    // susun baris html (nomor urut, judul lagu, jumlah dipakai berapa kali, dan tanggal terakhir dipakai)
    tbody.innerHTML = filtered.map((item, idx) => {
        const formattedLastDate = item.lastUsedDate ? formatShortDate(item.lastUsedDate, true) : '-';
        return `
            <tr>
                <td class="col-no">${idx + 1}</td>
                <td class="col-song-title">${escapeHtml(item.judul)}</td>
                <td class="col-song-count">${item.count} kali</td>
                <td class="col-song-last">${escapeHtml(formattedLastDate)}</td>
            </tr>
        `;
    }).join('');
}

// fungsi bantu buat ngambil bagian tanggalnya aja (yyyy-mm-dd) dan membuang embel-embel jam kalau ada
function extractCleanDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    return str.includes('T') ? str.split('T')[0] : str;
}

// fungsi bantu buat ngubah tanggal format yyyy-mm-dd jadi format pendek seperti "28 Jun 2026"
function formatShortDate(dateStr, padDay = false) {
    const clean = extractCleanDate(dateStr);
    const parts = clean.split('-');
    if (parts.length !== 3) return dateStr;

    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
        return dateStr;
    }

    // kalau padDay bernilai true, tambahkan angka 0 di depan tanggal satuan (contoh: "07 Jun 2026")
    const dayStr = padDay ? String(day).padStart(2, '0') : String(day);
    return `${dayStr} ${BULAN_SINGKAT[monthIdx]} ${year}`;
}

// fungsi bantu buat nyusun teks keterangan rentang periode aktif seperti "1 Jan – 30 Jun 2026"
function formatRangeLabel(startStr, endStr) {
    const sParts = extractCleanDate(startStr).split('-');
    const eParts = extractCleanDate(endStr).split('-');
    if (sParts.length !== 3 || eParts.length !== 3) {
        return `${startStr} – ${endStr}`;
    }

    const sYear = parseInt(sParts[0], 10);
    const sMonth = BULAN_SINGKAT[parseInt(sParts[1], 10) - 1] || '';
    const sDay = parseInt(sParts[2], 10);

    const eYear = parseInt(eParts[0], 10);
    const eMonth = BULAN_SINGKAT[parseInt(eParts[1], 10) - 1] || '';
    const eDay = parseInt(eParts[2], 10);

    // kalau tahun awal dan tahun akhirnya sama, tulis tahunnya sekali aja di bagian belakang
    if (sYear === eYear) {
        return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${eYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} – ${eDay} ${eMonth} ${eYear}`;
}

// fungsi bantu buat ngamanin teks sebelum dimasukin ke html supaya terhindar dari error karakter khusus (xss)
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
