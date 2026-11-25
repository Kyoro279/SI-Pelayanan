// public/js/dashboard.js

// untuk mengubah tanggal dan waktu jadwal menjadi objek Date lokal
function getScheduleDateTime(jadwal) {
    if (!jadwal || !jadwal.tanggal) return null;
    const cleanDate = jadwal.tanggal.includes('T') ? jadwal.tanggal.split('T')[0] : jadwal.tanggal;
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const rawTime = jadwal.jam_pelayanan || jadwal.waktu || '23:59';
    const cleanTime = rawTime.length >= 5 ? rawTime.substring(0, 5) : rawTime;
    const [hours, minutes] = cleanTime.split(':').map(val => parseInt(val, 10) || 0);

    return new Date(year, month, day, hours, minutes, 0, 0);
}

// mengecek apakah user yang sedang login dijadwalkan bertugas pada jadwal tersebut
function isUserAssignedInSchedule(jadwal) {
    if (!jadwal) return false;
    const userId = window.userData && window.userData.id_pengguna ? Number(window.userData.id_pengguna) : null;
    const userName = window.userData && (window.userData.nama_lengkap || window.userData.name)
        ? (window.userData.nama_lengkap || window.userData.name).trim().toLowerCase()
        : '';

    if (Array.isArray(jadwal.petugas)) {
        const found = jadwal.petugas.some(p => {
            if (userId && Number(p.id_pengguna) === userId) return true;
            if (userName && (p.nama_lengkap || '').trim().toLowerCase() === userName) return true;
            return false;
        });
        if (found) return true;
    }

    if (userId && jadwal.tim_pelayanan_id && typeof jadwal.tim_pelayanan_id === 'object') {
        if (Object.values(jadwal.tim_pelayanan_id).some(id => Number(id) === userId)) {
            return true;
        }
    }

    if (userName && jadwal.tim_pelayanan && typeof jadwal.tim_pelayanan === 'object') {
        if (Array.isArray(jadwal.tim_pelayanan)) {
            if (jadwal.tim_pelayanan.some(p => p.nama_pelayan && p.nama_pelayan.trim().toLowerCase() === userName)) {
                return true;
            }
        } else {
            if (Object.values(jadwal.tim_pelayanan).some(name => String(name || '').trim().toLowerCase() === userName)) {
                return true;
            }
        }
    }

    return false;
}

// pas halaman html selesai diload
document.addEventListener('DOMContentLoaded', async () => {
    // nunggu auth beres dulu
    if (window.authReady) {
        await window.authReady;
    }

    try {
        // narik semua data jadwal dari api
        const response = await fetch('/api/jadwal');
        if (!response.ok) throw new Error('Gagal mengambil data jadwal');
        const result = await response.json();
        const rawAllJadwal = result.data || [];

        // buang jam di tanggal kalo dia format iso
        rawAllJadwal.forEach(j => {
            if (j.tanggal && j.tanggal.includes('T')) {
                j.tanggal = j.tanggal.split('T')[0];
            }
        });

        // Render grafik Top 3 Servant & Top 3 Lagu selama 3 bulan terakhir (dari seluruh data jadwal)
        renderTopChartsLast3Months(rawAllJadwal);

        let allJadwal = [...rawAllJadwal];
        const role = window.userData ? (window.userData.role || '').trim().toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
        const canSeeAllJadwal = window.isSuperAdmin || role === 'admin' || role === 'worship planner' || role === 'wp';

        if (!canSeeAllJadwal) {
            allJadwal = allJadwal.filter(j => isUserAssignedInSchedule(j));
        }

        // waktu sekarang (tanggal dan jam saat ini)
        const now = new Date();

        // hanya ambil jadwal yang belum melewati H+1 jam dari jadwal pelaksanaan
        const futureJadwal = allJadwal.filter(j => {
            const dt = getScheduleDateTime(j);
            return dt && now.getTime() < (dt.getTime() + 60 * 60 * 1000);
        });

        // urutin dari jadwal yang paling dekat
        futureJadwal.sort((a, b) => getScheduleDateTime(a) - getScheduleDateTime(b));

        // nampilin jadwal ke layar
        renderDashboard(futureJadwal);
    } catch (err) {
        console.error('Error saat memuat jadwal:', err);
    }
});

// Fungsi untuk menghitung & menampilkan Grafik Bar Chart Tegak Lurus:
// Top 3 Servant Aktif & Top 3 Lagu Sering Digunakan dalam 3 Bulan Terakhir
function renderTopChartsLast3Months(schedules) {
    const servantChartEl = document.getElementById('chart-top-servants');
    const songChartEl = document.getElementById('chart-top-songs');
    const periodBadgeEl = document.getElementById('chart-period-label');
    if (!servantChartEl || !songChartEl) return;

    const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();

    // Rentang 3 bulan terakhir: dari awal 2 bulan lalu (total 3 bulan kalender termasuk bulan berjalan) hingga akhir bulan ini
    const startWindow = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    const endWindow = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (periodBadgeEl) {
        const startLabel = `${BULAN_SINGKAT[startWindow.getMonth()]} ${startWindow.getFullYear()}`;
        const endLabel = `${BULAN_SINGKAT[endWindow.getMonth()]} ${endWindow.getFullYear()}`;
        periodBadgeEl.textContent = `${startLabel} – ${endLabel}`;
    }

    // Saring jadwal yang berada dalam rentang 3 bulan terakhir
    const schedulesIn3Months = (schedules || []).filter(j => {
        const dt = getScheduleDateTime(j);
        return dt && dt >= startWindow && dt <= endWindow;
    });

    // 1. Hitung frekuensi pelayanan setiap Servant
    const servantCounts = new Map();
    function addServantCount(rawName) {
        const name = (rawName || '').trim();
        if (!name || name === '-') return;
        const key = name.toLowerCase();
        if (!servantCounts.has(key)) {
            servantCounts.set(key, { name, count: 0 });
        }
        servantCounts.get(key).count += 1;
    }

    // 2. Hitung frekuensi pemakaian setiap Lagu
    const songCounts = new Map();
    function addSongCount(songItem) {
        if (!songItem) return;
        const title = (songItem.judul_lagu || songItem.judul || '').trim();
        if (!title) return;
        const key = songItem.id_lagu ? `id_${songItem.id_lagu}` : `title_${title.toLowerCase()}`;
        if (!songCounts.has(key)) {
            songCounts.set(key, { name: title, count: 0 });
        }
        songCounts.get(key).count += 1;
    }

    schedulesIn3Months.forEach(j => {
        // Hitung pelayan dari petugas (jadwal_tugas) atau tim_pelayanan
        if (Array.isArray(j.petugas) && j.petugas.length > 0) {
            j.petugas.forEach(p => addServantCount(p.nama_lengkap));
        } else if (j.tim_pelayanan && typeof j.tim_pelayanan === 'object') {
            Object.values(j.tim_pelayanan).forEach(val => addServantCount(val));
        }

        // Hitung lagu dari daftar_lagu (jadwal_lagu)
        if (Array.isArray(j.daftar_lagu)) {
            j.daftar_lagu.forEach(s => addSongCount(s));
        }
    });

    const top3Servants = Array.from(servantCounts.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
        .slice(0, 3);

    const top3Songs = Array.from(songCounts.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
        .slice(0, 3);

    servantChartEl.innerHTML = buildVerticalBarChartHTML(top3Servants, 'servant-bar', 'tugas', 'Belum ada data pelayan dalam 3 bulan terakhir.');
    songChartEl.innerHTML = buildVerticalBarChartHTML(top3Songs, 'song-bar', 'kali', 'Belum ada lagu yang dipakai dalam 3 bulan terakhir.');
}

function buildVerticalBarChartHTML(items, barTypeClass, unitLabel, emptyMessage) {
    if (!items || items.length === 0) {
        return `<div class="chart-empty">${escapeHtml(emptyMessage)}</div>`;
    }

    const maxCount = Math.max(...items.map(i => i.count), 1);

    // Pastikan selalu ada 3 kolom supaya grafik bar tegak lurus tampak proporsional
    const slots = [0, 1, 2].map(idx => items[idx] || null);

    const barsHtml = slots.map((item, idx) => {
        const rank = idx + 1;
        if (!item) {
            return `
                <div class="vbar-col">
                    <span class="vbar-count" style="color: #94A3B8;">0</span>
                    <div class="vbar-bar empty-bar" style="height: 8px;"></div>
                </div>
            `;
        }
        // Tinggi bar proporsional terhadap nilai tertinggi (minimal 22% agar tetap jelas terlihat)
        const heightPct = Math.max(22, Math.round((item.count / maxCount) * 100));
        return `
            <div class="vbar-col" title="${escapeHtml(item.name)}: ${item.count} ${unitLabel}">
                <span class="vbar-count">${item.count} ${unitLabel}</span>
                <div class="vbar-bar ${barTypeClass} rank-${rank}" style="height: ${heightPct}%;">
                    <span class="vbar-rank-tag">#${rank}</span>
                </div>
            </div>
        `;
    }).join('');

    const labelsHtml = slots.map(item => {
        if (!item) {
            return `<div class="vbar-name muted">-</div>`;
        }
        return `<div class="vbar-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>`;
    }).join('');

    return `
        <div class="vbar-plot">
            ${barsHtml}
        </div>
        <div class="vbar-labels-row">
            ${labelsHtml}
        </div>
    `;
}

// ini buat ngatur ui htmlnya
function renderDashboard(futureJadwal) {
    // 1. set up bagian atas (pelayanan selanjutnya)
    const nextServiceContainer = document.querySelector('.next-service');

    // Ambil jadwal terdekat yang belum terjadi
    const nextJadwal = futureJadwal.length > 0 ? futureJadwal[0] : null;

    if (nextJadwal) {
        const formattedDate = formatTanggalLengkap(nextJadwal.tanggal);
        const rawWaktu = nextJadwal.jam_pelayanan || nextJadwal.waktu || '';
        const cleanWaktu = rawWaktu.length >= 5 ? rawWaktu.substring(0, 5) : rawWaktu;
        const timeDisplay = cleanWaktu ? ` • ${cleanWaktu} WIB` : '';
        const pengkotbahDisplay = nextJadwal.kategori === 'Latihan' || nextJadwal.kategori === 'Event' ? '-' : escapeHtml(nextJadwal.pengkotbah || '-');
        const judulDisplay = escapeHtml(nextJadwal.judul || nextJadwal.tema_pelayanan);
        const descDisplay = escapeHtml(nextJadwal.tujuan || '-');

        nextServiceContainer.innerHTML = `
            <div class="card-header">
                <span class="label">PELAYANAN BERIKUTNYA</span>
                <button class="btn-detail" onclick="window.location.href='/detail-jadwal.html?id=${nextJadwal.id}'">Detail →</button>
            </div>
            <div class="service-content">
                <h2>${judulDisplay}</h2>
                <p class="date">${formattedDate}${timeDisplay}</p>
                <p class="desc">${descDisplay}</p>
            </div>
            <div class="service-footer">
                <span class="footer-label">Pengkotbah</span>
                <span class="footer-value">${pengkotbahDisplay}</span>
            </div>
        `;
    } else {
        nextServiceContainer.innerHTML = `
            <div class="card-header">
                <span class="label">PELAYANAN BERIKUTNYA</span>
            </div>
            <div class="service-content">
                <h2>Tidak ada jadwal mendatang</h2>
                <p class="date">-</p>
                <p class="desc">Jadwal pelayanan saat ini kosong.</p>
            </div>
        `;
    }

    // 2. Jadwal Mendatang (daftar jadwal selanjutnya setelah pelayanan berikutnya)
    const scheduleGrid = document.querySelector('.schedule-grid');
    scheduleGrid.innerHTML = '';

    const upcomingList = futureJadwal.slice(1, 4); // Ambil maks 3 jadwal selanjutnya

    if (upcomingList.length > 0) {
        upcomingList.forEach(item => {
            const dateStr = formatTanggalLengkap(item.tanggal);
            const rawWaktu = item.jam_pelayanan || item.waktu || '';
            const cleanWaktu = rawWaktu.length >= 5 ? rawWaktu.substring(0, 5) : rawWaktu;
            const timeDisplay = cleanWaktu ? ` • ${cleanWaktu} WIB` : '';
            const card = document.createElement('div');
            card.className = 'schedule-card';
            card.style.cursor = 'pointer';
            card.onclick = () => window.location.href = `/detail-jadwal.html?id=${item.id}`;

            const pPengkotbah = item.kategori === 'Latihan' || item.kategori === 'Event' ? '-' : escapeHtml(item.pengkotbah || '-');

            card.innerHTML = `
                <p class="date">${dateStr}${timeDisplay}</p>
                <h3>${escapeHtml(item.judul || item.tema_pelayanan)}</h3>
                <p class="label">Pengkotbah</p>
                <p class="value">${pPengkotbah}</p>
            `;
            scheduleGrid.appendChild(card);
        });
    } else {
        scheduleGrid.innerHTML = '<p style="color: #64748B; font-size: 14px; grid-column: 1 / -1;">Tidak ada jadwal tambahan.</p>';
    }
}

// menyiapkan sebuah array berisi hari dan bulan 
const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDONESIA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatTanggalLengkap(dateStr) {
    // memecah string tanggal (tahun, bulan, tanggal)
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // urutan bulan dimulai dari 0 makanya harus dikurang 1
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);

        const namaHari = HARI_INDONESIA[dateObj.getDay()];
        const namaBulan = BULAN_INDONESIA[month];
        return `${namaHari}, ${day} ${namaBulan} ${year}`;
    }
    return dateStr;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- Notification Logic ---

function openNotificationModal() {
    document.getElementById('notif-overlay').style.display = 'block';
    document.getElementById('notif-modal').style.display = 'flex';
}

function closeNotificationModal() {
    document.getElementById('notif-overlay').style.display = 'none';
    document.getElementById('notif-modal').style.display = 'none';
}

// Fungsi untuk mengambil dan mengecek data notifikasi untuk pengguna yang sedang login
async function fetchNotifications() {
    let notifications = []; // Array untuk menampung daftar notifikasi
    const badge = document.getElementById('notif-badge'); // Elemen angka merah di icon lonceng
    const body = document.getElementById('notif-body'); // Elemen isi daftar notifikasi

    // Jika data user belum siap, hentikan fungsi ini
    if (!window.userData && !window.isSuperAdmin) return;

    // Menentukan role (peran) dan nama user dari data login
    const role = window.isSuperAdmin ? 'Admin' : (window.userData.role || 'Member');
    const userName = window.isSuperAdmin ? 'Admin' : window.userData.name;

    // 1. Admin/WP: Check Berhalangan reports
    if (role === 'Admin' || role === 'WP') {
        try {
            // kalo admin/wp yang yg login. maka akan memeriksa apakah ada yang mengajukan berhalangan dan belum diproses
            const res = await fetch('/api/berhalangan?status=Belum%20Diproses');
            if (res.ok) {
                // jika ada maka laporan tersebut dimasukan ke notifikasi
                const { data } = await res.json();
                if (data && data.length > 0) {
                    data.forEach(item => {
                        notifications.push({
                            type: 'berhalangan',
                            title: 'Laporan Berhalangan',
                            desc: `${item.nama} berhalangan untuk pelayanan '${item.judul_pelayanan}'`,
                            date: new Date(item.created_at),
                            link: '/berhalangan'
                        });
                    });
                }
            }
        } catch (e) { console.error('Error fetching berhalangan:', e); }
    }

    // 2. All roles: Check Schedule < 14 days
    try {
        // inisiasi mengambil data jadwal
        const resJadwal = await fetch('/api/jadwal');
        if (resJadwal.ok) {
            const { data } = await resJadwal.json();
            const now = new Date();
            const twoWeeksFromNow = new Date(now);
            twoWeeksFromNow.setDate(now.getDate() + 14);

            if (data && data.length > 0) {
                data.forEach(jadwal => {
                    const dt = getScheduleDateTime(jadwal);
                    if (dt && dt >= now && dt <= twoWeeksFromNow) {
                        // Check if user is in this schedule
                        const isAssigned = isUserAssignedInSchedule(jadwal);

                        if (isAssigned) { // jika terbukti ditugaskan maka akan memunculkan notifikasi
                            notifications.push({
                                type: 'jadwal',
                                title: 'Pengingat Pelayanan',
                                desc: `Anda memiliki pelayanan '${jadwal.judul || jadwal.tema_pelayanan}' pada ${formatTanggalLengkap(jadwal.tanggal)}`,
                                date: new Date(),
                                link: `/detail-jadwal.html?id=${jadwal.id}`
                            });
                        }
                    }
                });
            }
        }
    } catch (e) { console.error('Error fetching jadwal:', e); }

    // Tahap Akhir: Menampilkan (Render) Notifikasi ke Layar HTML
    if (notifications.length > 0) {
        // Jika ada 1 atau lebih notifikasi
        badge.textContent = notifications.length; // Mengubah angka pada ikon lonceng merah
        badge.style.display = 'flex'; // Memunculkan ikon lonceng merah tersebut
        body.innerHTML = ''; // Mengosongkan isi kotak notifikasi lama (jika ada)

        // Mengurutkan notifikasi dari yang paling baru (terbaru di atas)
        notifications.sort((a, b) => b.date - a.date);

        // Memasukkan setiap data notifikasi ke dalam elemen HTML baru
        notifications.forEach(notif => {
            const item = document.createElement('div'); // Membuat kotak <div> baru
            item.className = 'notif-item'; // Memberi class CSS untuk styling
            item.onclick = () => window.location.href = notif.link; // Jika diklik, pindah ke halaman link tujuan

            // Mengisi kotak tersebut dengan Judul dan Deskripsi
            item.innerHTML = `
                <div class="notif-title">${notif.title}</div>
                <div class="notif-desc">${notif.desc}</div>
            `;
            body.appendChild(item); // Memasukkan kotak <div> yang sudah jadi ke dalam menu dropdown notifikasi
        });
    } else {
        // Jika TIDAK ADA notifikasi sama sekali
        badge.textContent = '0'; // Set angka jadi 0 (meskipun disembunyikan)
        badge.style.display = 'none'; // Sembunyikan ikon lonceng merah
        // Tampilkan pesan kosong di dalam menu dropdown
        body.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px;">Tidak ada notifikasi baru.</p>';
    }
}

// Event Listener ini khusus bertugas untuk "menyalakan" fungsi notifikasi di atas
document.addEventListener('DOMContentLoaded', async () => {
    // Menunggu status login / autentikasi terkonfirmasi
    if (window.authReady) await window.authReady;

    // Setelah login sukses, langsung jalankan fungsi pencarian dan penampilan notifikasi
    fetchNotifications();
});
