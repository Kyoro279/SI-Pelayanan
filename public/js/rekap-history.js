//tunggu sampai semua elemen HTML beres dimuat sebelum jalanin script ini
document.addEventListener('DOMContentLoaded', () => {
    //ambil semua elemen penting dari HTML biar nanti gampang diotak-atik
    const btnPrevMonth = document.getElementById('btnPrevMonth'); //tombol mundur bulan
    const btnNextMonth = document.getElementById('btnNextMonth'); //tombol maju bulan
    const currentMonthLabel = document.getElementById('currentMonthLabel'); //label bulan di pojok kanan atas
    const statusMonthLabel = document.getElementById('statusMonthLabel'); //label bulan di bagian "Status Jadwal"
    
    const summaryTotal = document.getElementById('summaryTotal'); //kotak angka "Total jadwal"
    const summarySelesai = document.getElementById('summarySelesai'); //kotak angka "Sudah selesai"
    const summarySisa = document.getElementById('summarySisa'); //kotak angka "Sisa jadwal"
    
    const jadwalList = document.getElementById('jadwalList'); //wadah buat naruh daftar jadwal
    const progresList = document.getElementById('progresList'); //wadah buat naruh progress bar tiap pelayan

    //bikin variabel buat nyimpen tanggal hari ini, nantinya bakal dipake buat patokan bulan awal
    let currentDate = new Date(); 
    //variabel buat nampung semua data jadwal yang ditarik dari API
    let allJadwal = [];

    //array nama bulan buat ngerubah angka bulan (0-11) jadi teks (Januari-Desember)
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    //fungsi kecil buat ngubah format tanggal dari database (contoh: 2026-09-05) jadi enak dibaca (contoh: 5 September)
    function formatDateList(dateStr) {
        const d = new Date(dateStr);
        //kalau tanggalnya nggak valid, balikin aja teks aslinya biar nggak error
        if(isNaN(d)) return dateStr;
        //ambil tanggal (getDate) digabung sama nama bulan dari array monthNames
        return `${d.getDate()} ${monthNames[d.getMonth()]}`;
    }

    //fungsi buat narik data jadwal dari backend
    async function loadData() {
        try {
            //panggil API /api/jadwal
            const res = await fetch('/api/jadwal');
            const result = await res.json();
            
            //kalau sukses, simpan datanya ke variabel global allJadwal
            if (result.success) {
                allJadwal = result.data;
            } else {
                console.error("Failed to load jadwal:", result.message);
            }
            //setelah data dapet, langsung render (tampilin) buat bulan ini
            renderMonth();
        } catch (error) {
            console.error("Error loading jadwal:", error);
        }
    }

    //fungsi buat ngatur tampilan berdasarkan bulan yang lagi dipilih
    function renderMonth() {
        //ambil tahun dan bulan dari variabel currentDate
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        //gabungin jadi teks, contoh: "September 2026"
        const monthText = `${monthNames[month]} ${year}`;
        
        //update tulisan bulan di layar
        currentMonthLabel.textContent = monthText;
        statusMonthLabel.textContent = monthText;

        //panggil fungsi buat mikir (ngitung statistik) dan nampilin datanya
        processAndRenderData(year, month);
    }

    //ini fungsi paling berat otaknya, buat ngitung semua progress dan nampilin ke layar
    function processAndRenderData(year, month) {
        //filter jadwal khusus buat bulan dan tahun yang lagi dipilih aja
        const filteredJadwal = allJadwal.filter(j => {
            //antisipasi nama fieldnya antara 'tanggal' atau 'tanggal_pelayanan'
            const date = new Date(j.tanggal || j.tanggal_pelayanan);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        //siapin patokan hari ini (jam dinolin semua biar adil bandingin tanggalnya)
        const today = new Date();
        today.setHours(0,0,0,0);

        //variabel buat ngitung total selesai sama sisa di bulan ini
        let countSelesai = 0;
        let countSisa = 0;
        
        //object buat nyimpen rapot tiap pelayan. formatnya: { "Metiu": { total: 2, selesai: 1 } }
        const servantStats = {};

        //mulai loop tiap jadwal yang udah difilter
        filteredJadwal.forEach(j => {
            const date = new Date(j.tanggal || j.tanggal_pelayanan);
            //kalau tanggal jadwalnya lebih kecil dari hari ini, berarti acaranya udah lewat (selesai)
            const isSelesai = date < today; 

            //tambahin konter selesai atau sisa
            if (isSelesai) {
                countSelesai++;
            } else {
                countSisa++;
            }

            //hitung progress buat masing-masing pelayan di jadwal ini
            if (j.tim_pelayanan) {
                //bongkar objek tim_pelayanan jadi key-value (contoh: role="worship_leader", name="Cloud")
                Object.entries(j.tim_pelayanan).forEach(([role, name]) => {
                    const servantName = name ? name.trim() : "";
                    if (servantName) {
                        //kalau nama pelayan belum ada di buku rapot (servantStats), bikinin catatannya dulu
                        if (!servantStats[servantName]) {
                            servantStats[servantName] = { total: 0, selesai: 0 };
                        }
                        //tambahin 1 tugas ke total dia
                        servantStats[servantName].total++;
                        //kalau acaranya udah selesai, tambahin juga poin selesainya
                        if (isSelesai) {
                            servantStats[servantName].selesai++;
                        }
                    }
                });
            }
        });

        //update angka di 3 kotak paling atas
        summaryTotal.textContent = filteredJadwal.length;
        summarySelesai.textContent = countSelesai;
        summarySisa.textContent = countSisa;

        //tunjukin daftar jadwalnya di layar
        jadwalList.innerHTML = '';
        if (filteredJadwal.length === 0) {
            //kalau kosong, ya kasih tulisan kosong biar user nggak bingung
            jadwalList.innerHTML = '<p style="color: var(--text-muted);">Tidak ada jadwal di bulan ini.</p>';
        } else {
            //kalau ada, loop buat bikin elemen HTML-nya (komponen card kecil-kecil)
            filteredJadwal.forEach(j => {
                const date = new Date(j.tanggal || j.tanggal_pelayanan);
                const isSelesai = date < today;
                
                //nentuin warna dan icon badge, kalau selesai abu-abu, kalau belum biru muda
                let badgeClass = isSelesai ? 'selesai' : 'akan-datang';
                let badgeIcon = isSelesai ? 'ph-check-circle' : 'ph-clock';
                let badgeText = isSelesai ? 'Selesai' : 'Akan datang';
                
                //cari tau siapa Worship Leadernya buat ditampilin di teks
                let wlName = "Unknown";
                if(j.tim_pelayanan && j.tim_pelayanan.worship_leader) {
                    wlName = j.tim_pelayanan.worship_leader.trim();
                }

                //tempelin HTML-nya ke dalem wadah jadwalList
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

        //render progress bar buat tiap orang
        progresList.innerHTML = '';
        //urutin nama pelayan sesuai abjad biar rapi (Object.keys itu ngambil nama-namanya aja)
        const sortedServants = Object.keys(servantStats).sort();
        
        if (sortedServants.length === 0) {
            progresList.innerHTML = '<p style="color: var(--text-muted);">Belum ada penatalayan yang bertugas di bulan ini.</p>';
        } else {
            sortedServants.forEach(name => {
                const stats = servantStats[name];
                //ngitung sisa tugas orang ini
                const sisa = stats.total - stats.selesai;
                //ngitung persentase bar biru tuanya (kalau total 0 ya 0%, biar ga error division by zero)
                const percentage = stats.total === 0 ? 0 : (stats.selesai / stats.total) * 100;
                
                //bikin dan tempel elemen progress bar
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

    //tambahin fungsi klik buat tombol pindah bulan
    btnPrevMonth.addEventListener('click', () => {
        //kurangin bulan saat ini dengan 1 (mundur)
        currentDate.setMonth(currentDate.getMonth() - 1);
        //terus render ulang layarnya!
        renderMonth();
    });

    btnNextMonth.addEventListener('click', () => {
        //tambahin bulan saat ini dengan 1 (maju)
        currentDate.setMonth(currentDate.getMonth() + 1);
        //render ulang layarnya!
        renderMonth();
    });

    //mulai jalankan semuanya (panggil API pertama kali)
    loadData();
});
