//jalankan script rekap history setelah seluruh elemen halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    //tunggu proses pengecekan login dari checkAuth.js selesai
    if (window.authReady) {
        await window.authReady;
    }

    //ambil elemen navigasi bulan dan label bulan dari HTML
    const btnPrevMonth = document.getElementById('btnPrevMonth');
    const btnNextMonth = document.getElementById('btnNextMonth');
    const currentMonthLabel = document.getElementById('currentMonthLabel');
    const statusMonthLabel = document.getElementById('statusMonthLabel');

    //ambil elemen kotak ringkasan statistik di bagian atas
    const summaryTotal = document.getElementById('summaryTotal');
    const summarySelesai = document.getElementById('summarySelesai');
    const summarySisa = document.getElementById('summarySisa');

    //ambil wadah daftar status jadwal dan daftar progress per penatalayan
    const jadwalList = document.getElementById('jadwalList');
    const progresList = document.getElementById('progresList');

    //simpan patokan bulan yang sedang ditampilkan (tanggal diset ke 1 supaya aman saat pindah bulan)
    const currentDate = new Date();
    currentDate.setDate(1);

    //variabel penampung seluruh data jadwal dari database
    let allJadwal = [];

    //daftar nama bulan untuk tampilan label dan tanggal
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    //fungsi bantu buat mengubah tanggal YYYY-MM-DD menjadi format seperti "5 September"
    function formatDateList(dateStr) {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return `${d.getDate()} ${monthNames[d.getMonth()]}`;
    }

    //fungsi buat mengambil seluruh data jadwal dari backend API
    async function loadData() {
        try {
            const res = await fetch('/api/jadwal');
            const result = await res.json();

            if (result.success) {
                allJadwal = result.data || [];
            } else {
                console.error('Gagal memuat jadwal:', result.message);
            }

            //tampilkan rekap untuk bulan saat ini setelah data berhasil diambil
            renderMonth();
        } catch (error) {
            console.error('Error memuat jadwal:', error);
        }
    }

    //fungsi buat memperbarui label bulan dan memproses ulang data sesuai bulan yang dipilih
    function renderMonth() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthText = `${monthNames[month]} ${year}`;

        //perbarui teks nama bulan pada tombol pemilih dan judul bagian status jadwal
        currentMonthLabel.textContent = monthText;
        statusMonthLabel.textContent = monthText;

        processAndRenderData(year, month);
    }

    //fungsi buat menghitung statistik jadwal, merender daftar jadwal, dan merender progress penatalayan
    function processAndRenderData(year, month) {
        //saring jadwal yang berlangsung pada tahun dan bulan yang sedang dipilih
        const filteredJadwal = allJadwal.filter(j => {
            const date = new Date(j.tanggal_pelayanan || j.tanggal);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        //buat patokan tanggal hari ini (jam dinolkan agar perbandingan tanggal akurat)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let countSelesai = 0;
        let countSisa = 0;
        const servantStats = {};
        let jadwalHtml = '';

        //proses setiap jadwal pada bulan ini sekaligus susun HTML daftar jadwalnya dalam satu perulangan
        filteredJadwal.forEach(j => {
            const rawDate = j.tanggal_pelayanan || j.tanggal;
            const date = new Date(rawDate);
            //jadwal dianggap selesai apabila tanggal pelayanannya sudah lewat dari hari ini
            const isSelesai = date < today;

            if (isSelesai) {
                countSelesai++;
            } else {
                countSisa++;
            }

            //hitung jumlah tugas total dan tugas selesai untuk setiap pelayan di jadwal ini
            if (j.tim_pelayanan) {
                Object.values(j.tim_pelayanan).forEach(name => {
                    const servantName = name ? name.trim() : '';
                    if (!servantName) return;

                    if (!servantStats[servantName]) {
                        servantStats[servantName] = { total: 0, selesai: 0 };
                    }
                    servantStats[servantName].total++;
                    if (isSelesai) {
                        servantStats[servantName].selesai++;
                    }
                });
            }

            //tentukan tampilan badge status jadwal (selesai atau akan datang)
            const badgeClass = isSelesai ? 'selesai' : 'akan-datang';
            const badgeIcon = isSelesai ? 'ph-check-circle' : 'ph-clock';
            const badgeText = isSelesai ? 'Selesai' : 'Akan datang';

            //ambil nama worship leader dan judul/tema kotbah sesuai kolom database
            const wlName = (j.tim_pelayanan && j.tim_pelayanan.worship_leader)
                ? j.tim_pelayanan.worship_leader.trim()
                : '-';
            const judulJadwal = j.tema_kotbah || j.judul || 'Tanpa Judul';

            //tambahkan baris item jadwal ke dalam string HTML
            jadwalHtml += `
                <div class="jadwal-item">
                    <div class="jadwal-info">
                        <h4>${judulJadwal}</h4>
                        <p>${formatDateList(rawDate)} · WL ${wlName}</p>
                    </div>
                    <div class="status-badge ${badgeClass}">
                        <i class="ph ${badgeIcon}"></i> ${badgeText}
                    </div>
                </div>
            `;
        });

        //tampilkan angka statistik ke tiga kartu ringkasan di bagian atas
        summaryTotal.textContent = filteredJadwal.length;
        summarySelesai.textContent = countSelesai;
        summarySisa.textContent = countSisa;

        //tampilkan daftar status jadwal ke layar
        if (filteredJadwal.length === 0) {
            jadwalList.innerHTML = '<p style="color: var(--text-muted);">Tidak ada jadwal di bulan ini.</p>';
        } else {
            jadwalList.innerHTML = jadwalHtml;
        }

        //urutkan nama penatalayan sesuai abjad lalu tampilkan progress bar masing-masing
        const sortedServants = Object.keys(servantStats).sort();
        if (sortedServants.length === 0) {
            progresList.innerHTML = '<p style="color: var(--text-muted);">Belum ada penatalayan yang bertugas di bulan ini.</p>';
        } else {
            let progresHtml = '';
            sortedServants.forEach(name => {
                const stats = servantStats[name];
                const sisa = stats.total - stats.selesai;
                const percentage = stats.total === 0 ? 0 : (stats.selesai / stats.total) * 100;

                progresHtml += `
                    <div class="progres-item">
                        <div class="progres-header">
                            <div class="person-name">${name}</div>
                            <div class="progres-text">${stats.selesai}/${stats.total} selesai · <span>sisa ${sisa}</span></div>
                        </div>
                        <div class="progres-bar-container">
                            <div class="progres-bar-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            });
            progresList.innerHTML = progresHtml;
        }
    }

    //event klik tombol mundur satu bulan
    btnPrevMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderMonth();
    });

    //event klik tombol maju satu bulan
    btnNextMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderMonth();
    });

    //panggil data jadwal saat halaman pertama kali dibuka
    loadData();
});
