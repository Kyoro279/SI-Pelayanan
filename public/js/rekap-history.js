document.addEventListener('DOMContentLoaded', () => {
    const btnPrevMonth = document.getElementById('btnPrevMonth');
    const btnNextMonth = document.getElementById('btnNextMonth');
    const currentMonthLabel = document.getElementById('currentMonthLabel');
    const statusMonthLabel = document.getElementById('statusMonthLabel');
    
    const summaryTotal = document.getElementById('summaryTotal');
    const summarySelesai = document.getElementById('summarySelesai');
    const summarySisa = document.getElementById('summarySisa');
    
    const jadwalList = document.getElementById('jadwalList');
    const progresList = document.getElementById('progresList');

    let currentDate = new Date(); // Starts at today
    let allJadwal = [];

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    // Format tanggal untuk render jadwal list (e.g. "5 September")
    function formatDateList(dateStr) {
        const d = new Date(dateStr);
        if(isNaN(d)) return dateStr;
        return `${d.getDate()} ${monthNames[d.getMonth()]}`;
    }

    async function loadData() {
        try {
            const res = await fetch('/api/jadwal');
            const result = await res.json();
            if (result.success) {
                allJadwal = result.data;
            } else {
                console.error("Failed to load jadwal:", result.message);
            }
            renderMonth();
        } catch (error) {
            console.error("Error loading jadwal:", error);
        }
    }

    function renderMonth() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthText = `${monthNames[month]} ${year}`;
        
        currentMonthLabel.textContent = monthText;
        statusMonthLabel.textContent = monthText;

        processAndRenderData(year, month);
    }

    function processAndRenderData(year, month) {
        // Filter jadwal for the selected month and year
        const filteredJadwal = allJadwal.filter(j => {
            const date = new Date(j.tanggal || j.tanggal_pelayanan);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        const today = new Date();
        today.setHours(0,0,0,0);

        let countSelesai = 0;
        let countSisa = 0;
        
        const servantStats = {};

        // Process data
        filteredJadwal.forEach(j => {
            const date = new Date(j.tanggal || j.tanggal_pelayanan);
            const isSelesai = date < today; // Jika sudah lewat, anggap selesai

            if (isSelesai) {
                countSelesai++;
            } else {
                countSisa++;
            }

            // Process tim_pelayanan
            if (j.tim_pelayanan) {
                Object.entries(j.tim_pelayanan).forEach(([role, name]) => {
                    const servantName = name ? name.trim() : "";
                    if (servantName) {
                        if (!servantStats[servantName]) {
                            servantStats[servantName] = { total: 0, selesai: 0 };
                        }
                        servantStats[servantName].total++;
                        if (isSelesai) {
                            servantStats[servantName].selesai++;
                        }
                    }
                });
            }
        });

        // Update Summary Cards
        summaryTotal.textContent = filteredJadwal.length;
        summarySelesai.textContent = countSelesai;
        summarySisa.textContent = countSisa;

        // Render Jadwal List
        jadwalList.innerHTML = '';
        if (filteredJadwal.length === 0) {
            jadwalList.innerHTML = '<p style="color: var(--text-muted);">Tidak ada jadwal di bulan ini.</p>';
        } else {
            filteredJadwal.forEach(j => {
                const date = new Date(j.tanggal || j.tanggal_pelayanan);
                const isSelesai = date < today;
                
                let badgeClass = isSelesai ? 'selesai' : 'akan-datang';
                let badgeIcon = isSelesai ? 'ph-check-circle' : 'ph-clock';
                let badgeText = isSelesai ? 'Selesai' : 'Akan datang';
                
                // Get WL Name
                let wlName = "Unknown";
                if(j.tim_pelayanan && j.tim_pelayanan.worship_leader) {
                    wlName = j.tim_pelayanan.worship_leader.trim();
                }

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

        // Render Progres per Penatalayan
        progresList.innerHTML = '';
        const sortedServants = Object.keys(servantStats).sort();
        
        if (sortedServants.length === 0) {
            progresList.innerHTML = '<p style="color: var(--text-muted);">Belum ada penatalayan yang bertugas di bulan ini.</p>';
        } else {
            sortedServants.forEach(name => {
                const stats = servantStats[name];
                const sisa = stats.total - stats.selesai;
                const percentage = stats.total === 0 ? 0 : (stats.selesai / stats.total) * 100;
                
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

    // Event Listeners for Month Navigation
    btnPrevMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderMonth();
    });

    btnNextMonth.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderMonth();
    });

    // Start
    loadData();
});
