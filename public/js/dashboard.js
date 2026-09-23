// public/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    if (window.authReady) {
        await window.authReady;
    }

    try {
        const response = await fetch('/api/jadwal');
        if (!response.ok) throw new Error('Gagal mengambil data jadwal');
        const result = await response.json();
        const allJadwal = result.data || [];

        // Normalisasi tanggal ISO
        allJadwal.forEach(j => {
            if (j.tanggal && j.tanggal.includes('T')) {
                j.tanggal = j.tanggal.split('T')[0];
            }
        });

        // Urutkan berdasarkan tanggal terdekat ke masa depan (ascending)
        const today = new Date();
        today.setHours(0,0,0,0);

        const futureJadwal = allJadwal.filter(j => new Date(j.tanggal) >= today);
        futureJadwal.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        renderDashboard(futureJadwal, allJadwal);
    } catch (err) {
        console.error(err);
    }
});

function renderDashboard(futureJadwal, allJadwal) {
    // 1. Pelayanan Berikutnya (Card paling atas)
    const nextServiceContainer = document.querySelector('.next-service');
    
    // Jika tidak ada jadwal masa depan, ambil jadwal terbaru dari seluruh jadwal
    let nextJadwal = null;
    if (futureJadwal.length > 0) {
        nextJadwal = futureJadwal[0];
    } else if (allJadwal.length > 0) {
        // Fallback: ambil yang paling baru dibuat atau tanggal terbaru
        const pastJadwal = [...allJadwal].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        nextJadwal = pastJadwal[0];
    }

    if (nextJadwal) {
        const formattedDate = formatTanggalLengkap(nextJadwal.tanggal);
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
                <p class="date">${formattedDate}</p>
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

    // 2. Jadwal Mendatang (Sisa list)
    const scheduleGrid = document.querySelector('.schedule-grid');
    scheduleGrid.innerHTML = '';

    let upcomingList = [];
    if (futureJadwal.length > 1) {
        upcomingList = futureJadwal.slice(1, 4); // Ambil maks 3 jadwal selanjutnya
    } else if (futureJadwal.length === 1 && allJadwal.length > 1) {
        // Fallback jika cuma 1 di masa depan
        const pastJadwal = [...allJadwal].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).filter(j => j.id !== nextJadwal.id);
        upcomingList = pastJadwal.slice(0, 3);
    } else if (futureJadwal.length === 0 && allJadwal.length > 1) {
        const pastJadwal = [...allJadwal].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).filter(j => j.id !== nextJadwal.id);
        upcomingList = pastJadwal.slice(0, 3);
    }
    
    if (upcomingList.length > 0) {
        upcomingList.forEach(item => {
            const dateStr = formatTanggalLengkap(item.tanggal);
            const card = document.createElement('div');
            card.className = 'schedule-card';
            card.style.cursor = 'pointer';
            card.onclick = () => window.location.href = `/detail-jadwal.html?id=${item.id}`;
            
            const pPengkotbah = item.kategori === 'Latihan' || item.kategori === 'Event' ? '-' : escapeHtml(item.pengkotbah || '-');

            card.innerHTML = `
                <p class="date">${dateStr}</p>
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

const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDONESIA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

async function fetchNotifications() {
    let notifications = [];
    const badge = document.getElementById('notif-badge');
    const body = document.getElementById('notif-body');

    if (!window.userData && !window.isSuperAdmin) return;

    const role = window.isSuperAdmin ? 'Admin' : (window.userData.role || 'Member');
    const userName = window.isSuperAdmin ? 'Admin' : window.userData.name;

    // 1. Admin/WP: Check Berhalangan reports
    if (role === 'Admin' || role === 'WP') {
        try {
            const res = await fetch('/api/berhalangan?status=Belum%20Diproses');
            if (res.ok) {
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
        const resJadwal = await fetch('/api/jadwal');
        if (resJadwal.ok) {
            const { data } = await resJadwal.json();
            const today = new Date();
            today.setHours(0,0,0,0);
            const twoWeeksFromNow = new Date(today);
            twoWeeksFromNow.setDate(today.getDate() + 14);

            if (data && data.length > 0) {
                data.forEach(jadwal => {
                    const jDate = new Date(jadwal.tanggal);
                    if (jDate >= today && jDate <= twoWeeksFromNow) {
                        // Check if user is in this schedule
                        let isAssigned = false;
                        if (jadwal.pengkotbah && userName && jadwal.pengkotbah.toLowerCase() === userName.toLowerCase()) isAssigned = true;
                        if (jadwal.tim_pelayanan && Array.isArray(jadwal.tim_pelayanan)) {
                            const found = jadwal.tim_pelayanan.find(p => p.nama_pelayan && userName && p.nama_pelayan.toLowerCase() === userName.toLowerCase());
                            if (found) isAssigned = true;
                        }

                        if (isAssigned) {
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

    // Render notifications
    if (notifications.length > 0) {
        badge.textContent = notifications.length;
        badge.style.display = 'flex';
        body.innerHTML = '';
        notifications.sort((a,b) => b.date - a.date);
        
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = 'notif-item';
            item.onclick = () => window.location.href = notif.link;
            item.innerHTML = `
                <div class="notif-title">${notif.title}</div>
                <div class="notif-desc">${notif.desc}</div>
            `;
            body.appendChild(item);
        });
    } else {
        badge.textContent = '0';
        badge.style.display = 'none';
        body.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 20px;">Tidak ada notifikasi baru.</p>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.authReady) await window.authReady;
    fetchNotifications();
});