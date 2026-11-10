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
        const allJadwal = result.data || [];

        // buang jam di tanggal kalo dia format iso
        allJadwal.forEach(j => {
            if (j.tanggal && j.tanggal.includes('T')) {
                j.tanggal = j.tanggal.split('T')[0];
            }
        });

        // waktu sekarang (tanggal dan jam saat ini)
        const now = new Date();

        // hanya ambil jadwal yang belum terjadi (tanggal & jam belum lewat)
        const futureJadwal = allJadwal.filter(j => {
            const dt = getScheduleDateTime(j);
            return dt && dt >= now;
        });

        // urutin dari jadwal yang paling dekat
        futureJadwal.sort((a, b) => getScheduleDateTime(a) - getScheduleDateTime(b));

        // nampilin jadwal ke layar
        renderDashboard(futureJadwal);
    } catch (err) {
        console.error('Error saat memuat jadwal:', err);
    }
});

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
                        let isAssigned = false;
                        if (jadwal.pengkotbah && userName && jadwal.pengkotbah.toLowerCase() === userName.toLowerCase()) isAssigned = true;
                        // mengecek apakah user yang login merupakan bagian dari list tim pelayanan tersebut
                        if (jadwal.tim_pelayanan && Array.isArray(jadwal.tim_pelayanan)) {
                            const found = jadwal.tim_pelayanan.find(p => p.nama_pelayan && userName && p.nama_pelayan.toLowerCase() === userName.toLowerCase());
                            if (found) isAssigned = true;
                        }

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
