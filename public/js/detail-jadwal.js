// public/js/detail-jadwal.js
// ==============================================================================================
// FILE LOGIKA UNTUK HALAMAN DETAIL JADWAL PELAYANAN
// File ini bertugas menampilkan rincian jadwal, daftar tim pelayan, setlist lagu ibadah, 
// fitur penambahan & penghapusan lagu, serta percakapan Pesan Izin berhalangan hadir.
// ==============================================================================================

const BULAN_INDONESIA_IZIN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Menunggu hingga seluruh struktur halaman web (DOM) selesai dimuat oleh browser
document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. TUNGGU PROSES AUTENTIKASI ---
    if (window.authReady) {
        await window.authReady;
    }

    // --- 2. AMBIL ID JADWAL DARI URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const jadwalId = urlParams.get('id');

    if (!jadwalId) {
        alert("ID Jadwal tidak ditemukan!");
        window.location.href = '/jadwal';
        return;
    }

    // --- 3. PERIKSA HAK AKSES PENGGUNA (ROLE) ---
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    const canManageLaguJadwal = window.isSuperAdmin || role === 'admin' || role === 'worship planner' || role === 'worship leader';

    if (!canManageLaguJadwal) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    // --- 4. VARIABEL PENYIMPAN DATA (STATE) ---
    let currentJadwal = null;
    let allSongs = [];
    let choicesInstance = null;
    let activeIzinChat = null;

    // --- 5. TANGKAP ELEMEN-ELEMEN TAMPILAN (DOM) ---
    const loadingIndicator = document.getElementById('loading-indicator');
    const detailContent = document.getElementById('detail-content');

    const detailTanggal = document.getElementById('detail-tanggal');
    const detailJudul = document.getElementById('detail-judul');
    const detailTujuan = document.getElementById('detail-tujuan');
    const detailPengkotbah = document.getElementById('detail-pengkotbah');
    const timListContainer = document.getElementById('tim-list-container');
    const laguListContainer = document.getElementById('lagu-list-container');

    const btnTambahLagu = document.getElementById('btn-tambah-lagu');
    const formTambahLagu = document.getElementById('form-tambah-lagu');
    const selectLagu = document.getElementById('select-lagu');
    const selectKey = document.getElementById('select-key');
    const btnSubmitLagu = document.getElementById('btn-submit-lagu');
    const btnCancelLagu = document.getElementById('btn-cancel-lagu');

    // ==============================================================================================
    // FUNGSI UTAMA: MEMUAT SELURUH DATA DARI SERVER
    // ==============================================================================================
    async function loadData() {
        try {
            // Langkah A: Ambil data detail jadwal yang dipilih berdasarkan ID-nya
            const resJadwal = await fetch(`/api/jadwal/${jadwalId}`);
            const dataJadwal = await resJadwal.json();

            if (!dataJadwal.success || !dataJadwal.data) {
                alert("Gagal memuat jadwal!");
                window.location.href = '/jadwal';
                return;
            }

            currentJadwal = dataJadwal.data;

            // Langkah B: Jika user berhak mengelola lagu, ambil seluruh data lagu dari bank lagu
            if (canManageLaguJadwal) {
                const resLagu = await fetch('/api/lagu');
                const dataLagu = await resLagu.json();

                if (dataLagu.success) {
                    allSongs = dataLagu.data;
                    initChoices();
                }
            }

            // Langkah C: Gambar data informasi jadwal dan tim pelayanan ke kolom kiri
            renderDetail();

            // Langkah D: Gambar daftar setlist lagu yang sudah dipilih ke kolom kanan
            renderDaftarLagu();

            // Langkah E: Muat dan tampilkan bagian Pesan Izin di bawah grid
            await loadPesanIzin();

            // Sembunyikan lingkaran pemuatan (loading) dan tampilkan konten utama halaman
            loadingIndicator.style.display = 'none';
            detailContent.style.display = 'grid';

        } catch (error) {
            console.error("Error loading data:", error);
            alert("Terjadi kesalahan saat memuat data.");
        }
    }

    // ==============================================================================================
    // FUNGSI INISIALISASI DROPDOWN PENCARIAN LAGU (CHOICES.JS)
    // ==============================================================================================
    function initChoices() {
        const options = allSongs.map(lagu => ({
            value: lagu.id_lagu || lagu.id,
            label: `${lagu.judul_lagu || lagu.judul} - ${lagu.pengarang || lagu.penyanyi || 'Tanpa Penyanyi'} (Key Asli: ${lagu.nada_dasar || '-'})`
        }));

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

        selectLagu.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            const lagu = allSongs.find(l => String(l.id_lagu || l.id) === String(selectedId));

            if (lagu && lagu.nada_dasar) {
                selectKey.value = lagu.nada_dasar;
            }
        });
    }

    // ==============================================================================================
    // FUNGSI MERENDER INFORMASI JADWAL & TIM PELAYANAN (KOLOM KIRI)
    // ==============================================================================================
    function renderDetail() {
        const tgl = new Date(currentJadwal.tanggal || currentJadwal.tanggal_pelayanan);
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        detailTanggal.textContent = tgl.toLocaleDateString('id-ID', options).toUpperCase();

        detailJudul.textContent = currentJadwal.tema_kotbah || currentJadwal.judul || currentJadwal.tema_pelayanan;
        detailTujuan.textContent = currentJadwal.tujuan_ringkasan || currentJadwal.tujuan || '-';
        detailPengkotbah.textContent = currentJadwal.pengkotbah || '-';

        // --- BAGIAN TIM PELAYANAN ---
        const tim = currentJadwal.tim_pelayanan || {};

        const timOrder = [
            { key: 'worship_leader', label: 'Worship Leader' },
            { key: 'singer', label: 'Singer' },
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

            if (t.key === 'singer' && (tim.singer_1 || tim.singer_2)) {
                val = [tim.singer_1, tim.singer_2].filter(Boolean).join(', ');
            }
            if (t.key === 'usher' && (tim.usher_1 || tim.usher_2)) {
                val = [tim.usher_1, tim.usher_2].filter(Boolean).join(', ');
            }
            if (t.key === 'pianis' && tim.pianist) val = tim.pianist;

            const row = document.createElement('div');
            row.className = 'tim-row';
            row.innerHTML = `<div class="tim-label">${t.label}</div><div class="tim-value">${val}</div>`;
            timListContainer.appendChild(row);
        });
    }

    // ==============================================================================================
    // FUNGSI MERENDER DAFTAR LAGU / SETLIST (KOLOM KANAN)
    // ==============================================================================================
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
            item.style.cursor = 'pointer';

            const btnDelete = canManageLaguJadwal ? `<button class="btn-remove-lagu" data-index="${index}"><i class="ph ph-trash"></i></button>` : '';

            const namaJudul = lagu.judul_lagu || lagu.judul || 'Tanpa Judul';
            const laguIdRef = lagu.id_lagu || lagu.id || '';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap: 12px;">
                    <span style="font-weight:bold; color:#3182ce;">${index + 1}</span>
                    <span class="lagu-title">${namaJudul}</span>
                </div>
                <div class="lagu-actions">
                    <div class="lagu-key">${lagu.nada_dasar || '-'}</div>
                    ${btnDelete}
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-remove-lagu')) return;
                window.location.href = `/detail-lagu.html?id=${laguIdRef}&jadwal_id=${jadwalId}&index=${index}`;
            });

            laguListContainer.appendChild(item);
        });

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

    // ==============================================================================================
    // INTERAKSI FORMULIR TAMBAH LAGU (BUKA / TUTUP FORM)
    // ==============================================================================================
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

    // ==============================================================================================
    // MEMPROSES PENAMBAHAN LAGU KE DALAM JADWAL
    // ==============================================================================================
    if (btnSubmitLagu) {
        btnSubmitLagu.addEventListener('click', async () => {
            const selectedId = selectLagu.value;
            const selectedKey = selectKey.value;

            if (!selectedId) {
                alert("Silakan pilih lagu terlebih dahulu.");
                return;
            }

            const laguData = allSongs.find(l => String(l.id_lagu || l.id) === String(selectedId));
            if (!laguData) return;

            const newLaguObj = {
                id_lagu: laguData.id_lagu || laguData.id,
                judul: laguData.judul_lagu || laguData.judul,
                judul_lagu: laguData.judul_lagu || laguData.judul,
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
                    btnCancelLagu.click();
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

    // ==============================================================================================
    // FUNGSI MENGHAPUS LAGU DARI JADWAL
    // ==============================================================================================
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

    // ==============================================================================================
    // FITUR PESAN IZIN BERHALANGAN (SESUAI GAMBAR 4 & PRIVASI PELAYAN TERJADWAL)
    // ==============================================================================================
    async function getCurrentUserInfo() {
        let userId = window.userData ? window.userData.id_pengguna : null;
        let userName = window.userData && window.userData.nama_lengkap
            ? window.userData.nama_lengkap.trim()
            : '';
        let userEmail = window.userData && window.userData.email ? window.userData.email : '';
        let userRole = window.userData && window.userData.role
            ? window.userData.role.trim().toLowerCase()
            : (window.isSuperAdmin ? 'admin' : '');

        if ((!userName || !userEmail) && window.supabaseClient) {
            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session && session.user) {
                    const meta = session.user.user_metadata || {};
                    if (!userEmail) userEmail = session.user.email || '';
                    if (!userName) {
                        userName = (meta.full_name || meta.name || (userEmail ? userEmail.split('@')[0] : '')).trim();
                    }
                }
            } catch (e) {
                console.warn('Gagal mengambil session user:', e);
            }
        }

        if (!userName && window.isSuperAdmin) {
            userName = 'Admin KITTEENS';
        }

        return { userId, userName, userEmail, userRole };
    }

    function getScheduledUserIdInJadwal(userId, userName) {
        if (!currentJadwal) return userId;

        const petugasList = Array.isArray(currentJadwal.petugas) ? currentJadwal.petugas : [];
        if (userId) {
            const byId = petugasList.find(p => Number(p.id_pengguna) === Number(userId));
            if (byId) return Number(byId.id_pengguna);
        }
        if (userName) {
            const cleanName = userName.trim().toLowerCase();
            const byName = petugasList.find(p => (p.nama_lengkap || '').trim().toLowerCase() === cleanName);
            if (byName && byName.id_pengguna) return Number(byName.id_pengguna);
        }

        const timIds = currentJadwal.tim_pelayanan_id || {};
        if (userId && Object.values(timIds).some(id => Number(id) === Number(userId))) {
            return Number(userId);
        }
        const timNames = currentJadwal.tim_pelayanan || {};
        if (userName) {
            const cleanName = userName.trim().toLowerCase();
            for (const [roleKey, nameVal] of Object.entries(timNames)) {
                if (String(nameVal || '').trim().toLowerCase() === cleanName && timIds[roleKey]) {
                    return Number(timIds[roleKey]);
                }
            }
        }

        return userId;
    }

    function isUserScheduledInJadwal(userId, userName) {
        if (!currentJadwal) return false;

        // 1. Cek berdasarkan daftar petugas (jadwal_tugas)
        const petugasList = Array.isArray(currentJadwal.petugas) ? currentJadwal.petugas : [];
        if (userId && petugasList.some(p => Number(p.id_pengguna) === Number(userId))) {
            return true;
        }
        if (userName) {
            const cleanName = userName.trim().toLowerCase();
            if (petugasList.some(p => (p.nama_lengkap || '').trim().toLowerCase() === cleanName)) {
                return true;
            }
        }

        // 2. Cek berdasarkan objek tim_pelayanan_id dan tim_pelayanan
        const timIds = currentJadwal.tim_pelayanan_id || {};
        if (userId && Object.values(timIds).some(id => Number(id) === Number(userId))) {
            return true;
        }
        const timNames = currentJadwal.tim_pelayanan || {};
        if (userName) {
            const cleanName = userName.trim().toLowerCase();
            if (Object.values(timNames).some(n => String(n || '').trim().toLowerCase() === cleanName)) {
                return true;
            }
        }

        return false;
    }

    async function loadPesanIzin() {
        const berhalanganSection = document.getElementById('berhalangan-section');
        if (!berhalanganSection) return;

        const { userId: rawUserId, userName: currentUserName, userRole } = await getCurrentUserInfo();
        const currentUserId = getScheduledUserIdInJadwal(rawUserId, currentUserName);

        if (!currentUserName) {
            berhalanganSection.style.display = 'none';
            return;
        }

        const isScheduled = isUserScheduledInJadwal(currentUserId, currentUserName);
        const isWorshipPlanner = userRole === 'worship planner' || userRole === 'wp';

        // Servant / WL / MD yang TIDAK terjadwal di jadwal ini tidak boleh melihat atau mengirim Pesan Izin
        if (!isScheduled && !isWorshipPlanner) {
            berhalanganSection.style.display = 'none';
            return;
        }

        try {
            // Jika user terjadwal di jadwal ini, ambil HANYA percakapan izin milik dirinya sendiri (privasi 1-on-1)
            let apiUrl = `/api/berhalangan?id_jadwal=${jadwalId}`;
            if (isScheduled && currentUserId) {
                apiUrl += `&id_pengguna=${currentUserId}`;
            }

            const res = await fetch(apiUrl);
            const json = await res.json();
            const chats = (json && json.data) ? json.data : [];

            let matchedChat = null;
            if (isScheduled) {
                // Pelayan yang terjadwal HANYA boleh melihat percakapan miliknya sendiri
                if (currentUserId) {
                    matchedChat = chats.find(c => Number(c.id_pengguna) === Number(currentUserId));
                }
                if (!matchedChat && currentUserName) {
                    matchedChat = chats.find(c => (c.nama || '').trim().toLowerCase() === currentUserName.toLowerCase());
                }
            } else if (isWorshipPlanner) {
                // Jika Worship Planner yang tidak terjadwal membuka Detail Jadwal, tampilkan hanya jika ada pesan izin masuk
                if (chats.length === 0) {
                    berhalanganSection.style.display = 'none';
                    return;
                }
                matchedChat = chats[0];
            }

            berhalanganSection.style.display = 'block';
            activeIzinChat = matchedChat || null;

            // Hanya tandai 'Dibaca' jika yang sedang membuka halaman ini adalah pengirim pesan izin itu sendiri
            const isChatOwner = Boolean(
                activeIzinChat && (
                    (currentUserId && Number(activeIzinChat.id_pengguna) === Number(currentUserId)) ||
                    (currentUserName && (activeIzinChat.nama || '').trim().toLowerCase() === currentUserName.toLowerCase())
                )
            );

            const hasUnreadWpReply = activeIzinChat && (
                activeIzinChat.status_baca === 'Belum Dibaca' ||
                (Array.isArray(activeIzinChat.messages) && activeIzinChat.messages.some(m => m.sender === 'wp' && m.status_baca === 'Belum Dibaca'))
            );

            if (activeIzinChat && isChatOwner && activeIzinChat.pesan_balasan && hasUnreadWpReply) {
                try {
                    const readRes = await fetch(`/api/berhalangan/${activeIzinChat.id_chat}/baca`, { method: 'PUT' });
                    const readJson = await readRes.json();
                    if (readJson && readJson.success && readJson.data) {
                        activeIzinChat = readJson.data;
                    }
                } catch (e) {
                    console.warn('Gagal memperbarui status baca:', e);
                }
            }

            // Sembunyikan kotak kirim pesan izin jika yang melihat adalah WP yang tidak terjadwal di pelayanan ini (WP membalas dari menu Berhalangan)
            const replyBoxEl = berhalanganSection.querySelector('.izin-reply-box');
            if (replyBoxEl) {
                replyBoxEl.style.display = isScheduled ? 'block' : 'none';
            }

            renderPesanIzin(currentUserName);
        } catch (err) {
            console.error('Gagal memuat pesan izin:', err);
            renderPesanIzin(currentUserName);
        }
    }

    function renderPesanIzin(fallbackUserName) {
        const subtitleEl = document.getElementById('izin-subtitle');
        const statusBadgeEl = document.getElementById('izin-status-badge');
        const chatContainer = document.getElementById('izin-chat-container');
        const replyLabelEl = document.getElementById('izin-reply-label') || document.querySelector('.izin-reply-label');
        const inputAlasanEl = document.getElementById('input-alasan-berhalangan');
        const btnSubmitEl = document.getElementById('btn-submit-berhalangan');
        const judulJadwal = currentJadwal.tema_kotbah || currentJadwal.judul || currentJadwal.tema_pelayanan || 'Pelayanan';

        const displaySenderName = activeIzinChat ? activeIzinChat.nama : fallbackUserName;
        if (subtitleEl) {
            subtitleEl.textContent = `${displaySenderName} • ${judulJadwal}`;
        }

        if (!activeIzinChat) {
            if (statusBadgeEl) statusBadgeEl.style.display = 'none';
            if (chatContainer) {
                chatContainer.innerHTML = '';
                chatContainer.style.display = 'none';
            }
            if (replyLabelEl) replyLabelEl.textContent = 'Isi Pesan';
            if (inputAlasanEl) inputAlasanEl.placeholder = 'Tulis alasan berhalangan Anda untuk Worship Planner...';
            if (btnSubmitEl) btnSubmitEl.title = 'Kirim Pesan (Enter)';
            return;
        }

        if (replyLabelEl) replyLabelEl.textContent = 'Balas';
        if (inputAlasanEl) inputAlasanEl.placeholder = 'Tulis balasan untuk Worship Planner...';
        if (btnSubmitEl) btnSubmitEl.title = 'Kirim Balasan (Enter)';

        if (chatContainer) chatContainer.style.display = 'flex';

        const isSelesai = activeIzinChat.status_penanganan === 'Selesai';
        if (statusBadgeEl) {
            statusBadgeEl.style.display = 'inline-block';
            statusBadgeEl.className = `izin-status-pill ${isSelesai ? 'selesai' : 'proses'}`;
            statusBadgeEl.textContent = isSelesai ? 'Selesai' : 'Sedang Proses';
        }

        const senderInitials = getInitialsIzin(activeIzinChat.nama);
        const messages = Array.isArray(activeIzinChat.messages) && activeIzinChat.messages.length > 0
            ? activeIzinChat.messages
            : [
                ...(activeIzinChat.isi_pesan && activeIzinChat.isi_pesan !== '-' ? [{
                    sender: 'pelayan',
                    nama: activeIzinChat.nama,
                    text: activeIzinChat.isi_pesan,
                    timestamp: activeIzinChat.timestamp_kirim
                }] : []),
                ...(activeIzinChat.pesan_balasan ? [{
                    sender: 'wp',
                    nama: 'Worship Planner',
                    text: activeIzinChat.pesan_balasan,
                    timestamp: activeIzinChat.timestamp_balas || activeIzinChat.timestamp_kirim,
                    status_baca: activeIzinChat.status_baca
                }] : [])
            ];

        let lastDateStr = '';
        const htmlParts = [];

        messages.forEach(msg => {
            const dateStr = formatTanggalIzin(msg.timestamp);
            const timeStr = formatJamIzin(msg.timestamp);

            if (dateStr && dateStr !== lastDateStr) {
                htmlParts.push(`
                    <div class="izin-date-separator">
                        <span>${escapeHtmlIzin(dateStr)}</span>
                    </div>
                `);
                lastDateStr = dateStr;
            }

            if (msg.sender === 'wp') {
                const statusBacaStr = formatStatusBacaIzin(msg.status_baca);
                htmlParts.push(`
                    <div class="izin-chat-row">
                        <div class="izin-avatar">WP</div>
                        <div class="izin-bubble dark">
                            <div class="izin-bubble-sender">Worship Planner</div>
                            <div class="izin-bubble-text">${escapeHtmlIzin(msg.text)}</div>
                            <div class="izin-bubble-footer">
                                <span>${escapeHtmlIzin(timeStr)}</span>
                                <span class="izin-read-badge">${escapeHtmlIzin(statusBacaStr)}</span>
                            </div>
                        </div>
                    </div>
                `);
            } else {
                htmlParts.push(`
                    <div class="izin-chat-row">
                        <div class="izin-avatar">${escapeHtmlIzin(senderInitials)}</div>
                        <div class="izin-bubble light">
                            <div class="izin-bubble-sender">${escapeHtmlIzin(msg.nama || activeIzinChat.nama)}</div>
                            <div class="izin-bubble-text">${escapeHtmlIzin(msg.text)}</div>
                            <div class="izin-bubble-footer">
                                <span>${escapeHtmlIzin(timeStr)}</span>
                            </div>
                        </div>
                    </div>
                `);
            }
        });

        if (chatContainer) {
            chatContainer.innerHTML = htmlParts.join('');
        }
    }

    const btnSubmitBerhalangan = document.getElementById('btn-submit-berhalangan');
    const inputAlasanBerhalangan = document.getElementById('input-alasan-berhalangan');

    async function handleSendPesanIzin() {
        const inputAlasan = document.getElementById('input-alasan-berhalangan');
        if (!inputAlasan || (btnSubmitBerhalangan && btnSubmitBerhalangan.disabled)) return;
        const alasan = inputAlasan.value.trim();

        if (!alasan) {
            alert('Silakan tulis pesan terlebih dahulu.');
            inputAlasan.focus();
            return;
        }

        if (btnSubmitBerhalangan) btnSubmitBerhalangan.disabled = true;

        const { userId: rawUserId, userName: currentUserName, userEmail: currentUserEmail } = await getCurrentUserInfo();
        const currentUserId = getScheduledUserIdInJadwal(rawUserId, currentUserName);

        try {
            let res;
            if (activeIzinChat && activeIzinChat.id_chat) {
                res = await fetch(`/api/berhalangan/${activeIzinChat.id_chat}/balas`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_type: 'pelayan',
                        isi_pesan: alasan,
                        alasan: alasan
                    })
                });
            } else {
                res = await fetch('/api/berhalangan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_pengguna: currentUserId,
                        nama: currentUserName || 'Pelayan',
                        email: currentUserEmail,
                        id_jadwal: currentJadwal.id_jadwal || currentJadwal.id || jadwalId,
                        isi_pesan: alasan,
                        alasan: alasan
                    })
                });
            }

            const data = await res.json();
            if (res.ok && data.success) {
                inputAlasan.value = '';
                if (data.data) {
                    activeIzinChat = data.data;
                    renderPesanIzin(currentUserName);
                }
                await loadPesanIzin();
            } else {
                alert(data.message || 'Gagal mengirim pesan izin.');
            }
        } catch (err) {
            console.error(err);
            alert('Terjadi kesalahan sistem.');
        } finally {
            if (btnSubmitBerhalangan) {
                btnSubmitBerhalangan.disabled = false;
            }
        }
    }

    if (btnSubmitBerhalangan) {
        btnSubmitBerhalangan.addEventListener('click', handleSendPesanIzin);
    }

    if (inputAlasanBerhalangan) {
        inputAlasanBerhalangan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendPesanIzin();
            }
        });
    }

    function getInitialsIzin(name) {
        if (!name) return 'P';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }

    function formatTanggalIzin(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        const day = d.getDate();
        const month = BULAN_INDONESIA_IZIN[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
    }

    function formatJamIzin(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function formatStatusBacaIzin(statusBaca) {
        if (!statusBaca || statusBaca.toLowerCase() === 'belum dibaca') {
            return 'Belum Dibaca';
        }
        return 'Dibaca';
    }

    function escapeHtmlIzin(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- 6. EKSEKUSI AWAL ---
    loadData();
});
