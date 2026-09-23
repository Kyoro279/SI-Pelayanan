document.addEventListener('DOMContentLoaded', async () => {
    // Wait for auth to complete
    if (window.authReady) {
        await window.authReady;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const jadwalId = urlParams.get('id');

    if (!jadwalId) {
        alert("ID Jadwal tidak ditemukan!");
        window.location.href = '/jadwal';
        return;
    }

    // Cek role untuk manajemen lagu di jadwal
    const role = window.userData ? window.userData.role : (window.isSuperAdmin ? 'Admin' : 'Guest');
    const canManageLaguJadwal = window.isSuperAdmin || role === 'Admin' || role === 'Worship Planner' || role === 'Worship Leader';
    if (!canManageLaguJadwal) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    let currentJadwal = null;
    let allSongs = [];
    let choicesInstance = null;

    const loadingIndicator = document.getElementById('loading-indicator');
    const detailContent = document.getElementById('detail-content');

    // DOM Elements
    const detailTanggal = document.getElementById('detail-tanggal');
    const detailJudul = document.getElementById('detail-judul');
    const detailTujuan = document.getElementById('detail-tujuan');
    const detailPengkotbah = document.getElementById('detail-pengkotbah');
    const timListContainer = document.getElementById('tim-list-container');
    const laguListContainer = document.getElementById('lagu-list-container');
    
    // Form Elements
    const btnTambahLagu = document.getElementById('btn-tambah-lagu');
    const formTambahLagu = document.getElementById('form-tambah-lagu');
    const selectLagu = document.getElementById('select-lagu');
    const selectKey = document.getElementById('select-key');
    const btnSubmitLagu = document.getElementById('btn-submit-lagu');
    const btnCancelLagu = document.getElementById('btn-cancel-lagu');

    // Load Data
    async function loadData() {
        try {
            // Fetch Jadwal Detail
            const resJadwal = await fetch(`/api/jadwal/${jadwalId}`);
            const dataJadwal = await resJadwal.json();
            
            if (!dataJadwal.success || !dataJadwal.data) {
                alert("Gagal memuat jadwal!");
                window.location.href = '/jadwal';
                return;
            }
            currentJadwal = dataJadwal.data;

            // Fetch Semua Lagu (Untuk Form Tambah)
            if (canManageLaguJadwal) {
                const resLagu = await fetch('/api/lagu');
                const dataLagu = await resLagu.json();
                if (dataLagu.success) {
                    allSongs = dataLagu.data;
                    initChoices();
                }
            }

            renderDetail();
            renderDaftarLagu();

            loadingIndicator.style.display = 'none';
            detailContent.style.display = 'grid';

        } catch (error) {
            console.error("Error loading data:", error);
            alert("Terjadi kesalahan saat memuat data.");
        }
    }

    function initChoices() {
        const options = allSongs.map(lagu => ({
            value: lagu.id,
            label: `${lagu.judul} - ${lagu.penyanyi || 'Tanpa Penyanyi'} (Key Asli: ${lagu.nada_dasar})`
        }));
        
        // Bersihkan HTML bawaan agar tidak duplikat
        selectLagu.innerHTML = '';
        
        choicesInstance = new Choices(selectLagu, {
            searchEnabled: true,
            itemSelectText: '',
            shouldSort: false,
            choices: [
                { value: '', label: 'Cari Nama Lagu', placeholder: true },
                ...options
            ]
        });

        // Event listener saat pilih lagu, otomatis set key bawaannya
        selectLagu.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            const lagu = allSongs.find(l => l.id === selectedId);
            if (lagu && lagu.nada_dasar) {
                selectKey.value = lagu.nada_dasar;
            }
        });
    }

    function renderDetail() {
        const tgl = new Date(currentJadwal.tanggal || currentJadwal.tanggal_pelayanan);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        detailTanggal.textContent = tgl.toLocaleDateString('id-ID', options);
        detailJudul.textContent = currentJadwal.judul || currentJadwal.tema_pelayanan;
        detailTujuan.textContent = currentJadwal.tujuan || '-';
        detailPengkotbah.textContent = currentJadwal.pengkotbah || '-';

        // Render Tim Pelayanan
        const tim = currentJadwal.tim_pelayanan || {};
        const timOrder = [
            { key: 'worship_leader', label: 'Worship Leader' },
            { key: 'singer', label: 'Singer' }, // Old property has singer_1, singer_2 but maybe they combined?
            { key: 'pianis', label: 'Pianis' },
            { key: 'bassist', label: 'Bassist' },
            { key: 'gitaris', label: 'Gitaris' },
            { key: 'drummer', label: 'Drummer' },
            { key: 'mcm', label: 'MCM' },
            { key: 'lighting', label: 'Lighting' },
            { key: 'soundman', label: 'Soundman' },
            { key: 'usher', label: 'Usher' }
        ];

        timListContainer.innerHTML = '';
        timOrder.forEach(t => {
            let val = tim[t.key] || '-';
            // Handle old fields if they exist
            if (t.key === 'singer' && (tim.singer_1 || tim.singer_2)) {
                val = [tim.singer_1, tim.singer_2].filter(Boolean).join(', ');
            }
            if (t.key === 'usher' && (tim.usher_1 || tim.usher_2)) {
                val = [tim.usher_1, tim.usher_2].filter(Boolean).join(', ');
            }
            // Handle pianis vs pianist spelling
            if (t.key === 'pianis' && tim.pianist) val = tim.pianist;

            const row = document.createElement('div');
            row.className = 'tim-row';
            row.innerHTML = `<div class="tim-label">${t.label}</div><div class="tim-value">${val}</div>`;
            timListContainer.appendChild(row);
        });

        // Tampilkan section berhalangan untuk semua role/user yang sedang login
        const userName = window.userData ? window.userData.nama_lengkap : (window.isSuperAdmin ? 'Super Admin' : '');
        const berhalanganSection = document.getElementById('berhalangan-section');
        if (userName && berhalanganSection) {
            berhalanganSection.style.display = 'block';
        }
    }

    function renderDaftarLagu() {
        laguListContainer.innerHTML = '';
        const daftarLagu = currentJadwal.daftar_lagu || [];

        if (daftarLagu.length === 0) {
            laguListContainer.innerHTML = '<div class="empty-lagu">Belum ada lagu.</div>';
            return;
        }

        daftarLagu.forEach((lagu, index) => {
            const item = document.createElement('div');
            item.className = 'lagu-item';
            item.style.cursor = 'pointer'; // Make the box look clickable
            
            const btnDelete = canManageLaguJadwal ? `<button class="btn-remove-lagu" data-index="${index}"><i class="ph ph-trash"></i></button>` : '';

            item.innerHTML = `
                <div style="display:flex; align-items:center; gap: 12px;">
                    <span style="font-weight:bold; color:#3182ce;">${index + 1}</span>
                    <span class="lagu-title">${lagu.judul}</span>
                </div>
                <div class="lagu-actions">
                    <div class="lagu-key">${lagu.nada_dasar}</div>
                    ${btnDelete}
                </div>
            `;
            
            // Allow clicking anywhere on the box to go to setlist mode
            item.addEventListener('click', (e) => {
                // If they clicked the delete button, don't trigger navigation
                if (e.target.closest('.btn-remove-lagu')) return;
                
                window.location.href = `/detail-lagu.html?id=${lagu.id_lagu}&jadwal_id=${jadwalId}&index=${index}`;
            });
            
            laguListContainer.appendChild(item);
        });

        // Bind delete events
        if (canManageLaguJadwal) {
            document.querySelectorAll('.btn-remove-lagu').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idx = e.currentTarget.getAttribute('data-index');
                    if (confirm('Hapus lagu ini dari jadwal?')) {
                        await hapusLaguDariJadwal(idx);
                    }
                });
            });
        }
    }

    // Toggle Form Add Lagu
    if (btnTambahLagu) {
        btnTambahLagu.addEventListener('click', () => {
            formTambahLagu.style.display = 'block';
            btnTambahLagu.style.display = 'none';
        });
    }

    if (btnCancelLagu) {
        btnCancelLagu.addEventListener('click', () => {
            formTambahLagu.style.display = 'none';
            btnTambahLagu.style.display = 'block';
            if (choicesInstance) choicesInstance.setChoiceByValue('');
        });
    }

    // Submit Lagu
    if (btnSubmitLagu) {
        btnSubmitLagu.addEventListener('click', async () => {
            const selectedId = selectLagu.value;
            const selectedKey = selectKey.value;

            if (!selectedId) {
                alert("Silakan pilih lagu terlebih dahulu.");
                return;
            }

            const laguData = allSongs.find(l => l.id === selectedId);
            if (!laguData) return;

            const newLaguObj = {
                id_lagu: laguData.id,
                judul: laguData.judul,
                nada_dasar: selectedKey
            };

            const daftarLaguSekarang = currentJadwal.daftar_lagu || [];
            daftarLaguSekarang.push(newLaguObj);

            btnSubmitLagu.disabled = true;
            btnSubmitLagu.textContent = 'Menyimpan...';

            try {
                const res = await fetch(`/api/jadwal/${jadwalId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ daftar_lagu: daftarLaguSekarang })
                });

                const data = await res.json();
                if (data.success) {
                    currentJadwal.daftar_lagu = daftarLaguSekarang;
                    renderDaftarLagu();
                    btnCancelLagu.click(); // Hide form
                } else {
                    alert('Gagal menyimpan lagu ke jadwal.');
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan saat menyimpan.');
            } finally {
                btnSubmitLagu.disabled = false;
                btnSubmitLagu.textContent = 'Masukkan';
            }
        });
    }

    async function hapusLaguDariJadwal(index) {
        const daftarLaguSekarang = currentJadwal.daftar_lagu || [];
        daftarLaguSekarang.splice(index, 1);

        try {
            const res = await fetch(`/api/jadwal/${jadwalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daftar_lagu: daftarLaguSekarang })
            });
            const data = await res.json();
            if (data.success) {
                currentJadwal.daftar_lagu = daftarLaguSekarang;
                renderDaftarLagu();
            }
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus lagu.');
        }
    }

    // Submit Berhalangan
    const btnSubmitBerhalangan = document.getElementById('btn-submit-berhalangan');
    if (btnSubmitBerhalangan) {
        btnSubmitBerhalangan.addEventListener('click', async () => {
            const inputAlasan = document.getElementById('input-alasan-berhalangan');
            const alasan = inputAlasan.value.trim();

            if (!alasan) {
                alert('Silakan tulis alasan berhalangan Anda terlebih dahulu.');
                return;
            }

            if (!confirm('Kirim laporan berhalangan untuk jadwal ini?')) return;

            btnSubmitBerhalangan.disabled = true;
            btnSubmitBerhalangan.textContent = 'Mengirim...';

            const payload = {
                nama: window.userData ? window.userData.nama_lengkap : 'Super Admin',
                catatan: `Laporan dari ${window.userData ? window.userData.nama_lengkap : 'Super Admin'}`,
                id_jadwal: currentJadwal.id,
                judul_pelayanan: currentJadwal.judul || currentJadwal.tema_pelayanan,
                jadwal_tanggal: new Date(currentJadwal.tanggal || currentJadwal.tanggal_pelayanan).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                alasan: alasan
            };

            try {
                const res = await fetch('/api/berhalangan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.success) {
                    alert('Laporan berhalangan berhasil dikirim.');
                    inputAlasan.value = '';
                    inputAlasan.disabled = true;
                    btnSubmitBerhalangan.textContent = 'Terkirim';
                } else {
                    alert(data.message || 'Gagal mengirim laporan berhalangan.');
                    btnSubmitBerhalangan.disabled = false;
                    btnSubmitBerhalangan.textContent = 'Kirim Laporan';
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan sistem.');
                btnSubmitBerhalangan.disabled = false;
                btnSubmitBerhalangan.textContent = 'Kirim Laporan';
            }
        });
    }

    // Init
    loadData();
});
