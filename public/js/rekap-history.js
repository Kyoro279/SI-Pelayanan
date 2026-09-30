// Tunggu sampai semua elemen HTML beres dimuat sebelum jalanin script ini
document.addEventListener('DOMContentLoaded', () => {
    // Ambil semua elemen penting dari HTML biar nanti gampang diotak-atik
    const btnPrevMonth = document.getElementById('btnPrevMonth'); // Tombol mundur bulan
    const btnNextMonth = document.getElementById('btnNextMonth'); // Tombol maju bulan
    const currentMonthLabel = document.getElementById('currentMonthLabel'); // Label bulan di pojok kanan atas
    const statusMonthLabel = document.getElementById('statusMonthLabel'); // Label bulan di bagian "Status Jadwal"
    
    const summaryTotal = document.getElementById('summaryTotal'); // Kotak angka "Total jadwal"
    const summarySelesai = document.getElementById('summarySelesai'); // Kotak angka "Sudah selesai"
    const summarySisa = document.getElementById('summarySisa'); // Kotak angka "Sisa jadwal"
    
    const jadwalList = document.getElementById('jadwalList'); // Wadah buat naruh daftar jadwal
    const progresList = document.getElementById('progresList'); // Wadah buat naruh progress bar tiap pelayan

    // Bikin variabel buat nyimpen tanggal hari ini, nantinya bakal dipake buat patokan bulan awal
    let currentDate = new Date(); 
    // Variabel buat nampung semua data jadwal yang ditarik dari API
    let allJadwal = [];

    // Array nama bulan buat ngerubah angka bulan (0-11) jadi teks (Januari-Desember)
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    // Fungsi kecil buat ngubah format tanggal dari database (contoh: 2026-09-05) jadi enak dibaca (contoh: 5 September)
    function formatDateList(dateStr) {
        const d = new Date(dateStr);
        // Kalau tanggalnya nggak valid, balikin aja teks aslinya biar nggak error
        if(isNaN(d)) return dateStr;
        // Ambil tanggal (getDate) digabung sama nama bulan dari array monthNames
        return `${d.getDate()} ${monthNames[d.getMonth()]}`;
    }

    // Fungsi buat narik data jadwal dari backend
    async function loadData() {
        try {
            // Panggil API /api/jadwal
            const res = await fetch('/api/jadwal');
            const result = await res.json();
            
            // Kalau sukses, simpan datanya ke variabel global allJadwal
            if (result.success) {
                allJadwal = result.data;
            } else {
                console.error("Failed to load jadwal:", result.message);
            }
            // Setelah data dapet, langsung render (tampilin) buat bulan ini
            renderMonth();
        } catch (error) {
            console.error("Error loading jadwal:", error);
        }
    }

    // Fungsi buat ngatur tampilan berdasarkan bulan yang lagi dipilih
    function renderMonth() {
        // Ambil tahun dan bulan dari variabel currentDate
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // Gabungin jadi teks, contoh: "September 2026"
        const monthText = `${monthNames[month]} ${year}`;
        
        // Update tulisan bulan di layar
        currentMonthLabel.textContent = monthText;
        statusMonthLabel.textContent = monthText;

        // Panggil fungsi buat mikir (ngitung statistik) dan nampilin datanya
        processAndRenderData(year, month);
    }

    // Ini fungsi paling berat otaknya, buat ngitung semua progress dan nampilin ke layar
    function processAndRenderData(year, month) {
        // 1. Filter jadwal khusus buat bulan dan tahun yang lagi dipilih aja
        const filteredJadwal = allJadwal.filter(j => {
            // Antisipasi nama fieldnya antara 'tanggal' atau 'tanggal_pelayanan'
            const date = new Date(j.tanggal || j.tanggal_pelayanan);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        // 2. Siapin patokan hari ini (jam dinolin semua biar adil bandingin tanggalnya)
        const today = new Date();
        today.setHours(0,0,0,0);

        // Variabel buat ngitung total selesai sama sisa di bulan ini
        let countSelesai = 0;
        let countSisa = 0;
        
        // Object buat nyimpen rapot tiap pelayan. Formatnya: { "Metiu": { total: 2, selesai: 1 } }
        const servantStats = {};

        // 3. Mulai loop tiap jadwal yang udah difilter
        filteredJadwal.forEach(j => {
            const date = new Date(j.tanggal || j.tanggal_pelayanan);
            // Kalau tanggal jadwalnya lebih kecil dari hari ini, berarti acaranya udah lewat (selesai)
            const isSelesai = date < today; 

            // Tambahin konter selesai atau sisa
            if (isSelesai) {
                countSelesai++;
            } else {
                countSisa++;
            }

            // 4. Hitung progress buat masing-masing pelayan di jadwal ini
            if (j.tim_pelayanan) {
                // Bongkar objek tim_pelayanan jadi key-value (contoh: role="worship_leader", name="Cloud")
                Object.entries(j.tim_pelayanan).forEach(([role, name]) => {
                    const servantName = name ? name.trim() : "";
                    if (servantName) {
                        // Kalau nama pelayan belum ada di buku rapot (servantStats), bikinin catatannya dulu
                        if (!servantStats[servantName]) {
                            servantStats[servantName] = { total: 0, selesai: 0 };
                        }
                        // Tambahin 1 tugas ke total dia
                        servantStats[servantName].total++;
                        // Kalau acaranya udah selesai, tambahin juga poin selesainya
                        if (isSelesai) {
                            servantStats[servantName].selesai++;
                        }
                    }
                });
            }
        });

        // 5. Update angka di 3 kotak paling atas
        summaryTotal.textContent = filteredJadwal.length;
        summarySelesai.textContent = countSelesai;
        summarySisa.textContent = countSisa;

        // 6. Tunjukin daftar jadwalnya di layar
        jadwalList.innerHTML = '';
        if (filteredJadwal.length === 0) {
            // Kalau kosong, ya kasih tulisan kosong biar user nggak bingung
            jadwalList.innerHTML = '<p style="color: var(--text-muted);">Tidak ada jadwal di bulan ini.</p>';
        } else {
            // Kalau ada, loop buat bikin elemen HTML-nya (komponen card kecil-kecil)
            filteredJadwal.forEach(j => {
                const date = new Date(j.tanggal || j.tanggal_pelayanan);
                const isSelesai = date < today;
                
                // Nentuin warna dan icon badge, kalau selesai abu-abu, kalau belum biru muda
                let badgeClass = isSelesai ? 'selesai' : 'akan-datang';
                let badgeIcon = isSelesai ? 'ph-check-circle' : 'ph-clock';
                let badgeText = isSelesai ? 'Selesai' : 'Akan datang';
                
                // Cari tau siapa Worship Leadernya buat ditampilin di teks
                let wlName = "Unknown";
                if(j.tim_pelayanan && j.tim_pelayanan.worship_leader) {
                    wlName = j.tim_pelayanan.worship_leader.trim();
                }

                // Tempelin HTML-nya ke dalem wadah jadwalList
                jadwalList.innerHTML += `
                    <div class="jadwal-item">
                        <div class="jadwal-info">
                            <h4>${j.judul || j.tema_pelayanan || 'Tanpa Judul'}</h4>
                            <p>${formatDateList(j.tanggal || j.tanggal_pelayanan)} · WL ${wlName}</p>
                        </div>
                        <div class="status-badge ${badgeClass}">
                            <i class="ph ${badgeIcon}"></i> ${badgeText}
                        </div>
                    </div>
                `;
            });
        }

        // 7. Render Progress Bar buat tiap orang
        progresList.innerHTML = '';
        // Urutin nama pelayan sesuai abjad biar rapi (Object.keys itu ngambil nama-namanya aja)
        const sortedServants = Object.keys(servantStats).sort();
        
        if (sortedServants.length === 0) {
            progresList.innerHTML = '<p style="color: var(--text-muted);">Belum ada penatalayan yang bertugas di bulan ini.</p>';
        } else {
            sortedServants.forEach(name => {
                const stats = servantStats[name];
                // Ngitung sisa tugas orang ini
                const sisa = stats.total - stats.selesai;
                // Ngitung persentase bar biru tuanya (kalau total 0 ya 0%, biar ga error division by zero)
                const percentage = stats.total === 0 ? 0 : (stats.selesai / stats.total) * 100;
                
                // Bikin dan tempel elemen progress bar
                progresList.innerHTML += `
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
        }
    }

    // 8. Tambahin fungsi klik buat tombol pindah bulan
    btnPrevMonth.addEventListener('click', () => {
        // Kurangin bulan saat ini dengan 1 (Mundur)
        currentDate.setMonth(currentDate.getMonth() - 1);
        // Terus render ulang layarnya!
        renderMonth();
    });

    btnNextMonth.addEventListener('click', () => {
        // Tambahin bulan saat ini dengan 1 (Maju)
        currentDate.setMonth(currentDate.getMonth() + 1);
        // Render ulang layarnya!
        renderMonth();
    });

    // 9. Mulai jalankan semuanya (Panggil API pertama kali)
    loadData();
});
