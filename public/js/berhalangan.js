// public/js/berhalangan.js

let currentFilter = 'belum'; // 'belum' atau 'semua'
let berhalanganData = [];
let akunList = [];
let jadwalList = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tunggu autentikasi selesai
    if (window.authReady) {
        await window.authReady;
    }

    // 2. Inisialisasi event listener filter & modal
    initFilterTabs();
    initModalEvents();

    // 3. Load data paralel (berhalangan, akun untuk pengganti, dan jadwal)
    await Promise.all([
        fetchAkunList(),
        fetchJadwalList(),
        loadBerhalanganData()
    ]);
});

// ==========================================
// 1. FETCH DATA
// ==========================================

async function fetchAkunList() {
    try {
        const res = await fetch('/api/akun');
        if (res.ok) {
            akunList = await res.json();
        }
    } catch (err) {
        console.warn('Gagal memuat data akun untuk pengganti:', err);
    }
}

async function fetchJadwalList() {
    try {
        const res = await fetch('/api/jadwal');
        if (res.ok) {
            const data = await res.json();
            jadwalList = data.data || [];
            populateJadwalSelect();
        }
    } catch (err) {
        console.warn('Gagal memuat data jadwal:', err);
    }
}

async function loadBerhalanganData() {
    const container = document.getElementById('berhalangan-container');
    try {
        const res = await fetch('/api/berhalangan');
        if (!res.ok) throw new Error('Gagal mengambil data permintaan berhalangan');
        const json = await res.json();
        berhalanganData = json.data || [];
        renderList();
    } catch (err) {
        console.error('Error loadBerhalanganData:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-warning-circle"></i>
                <h3>Terjadi Kesalahan</h3>
                <p>${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

// ==========================================
// 2. RENDER LIST KARTU
// ==========================================

function renderList() {
    const container = document.getElementById('berhalangan-container');
    if (!container) return;

    // Filter data sesuai tab yang dipilih
    let filtered = berhalanganData;
    if (currentFilter === 'belum') {
        filtered = berhalanganData.filter(item => 
            !item.status || item.status.toLowerCase() === 'belum diproses'
        );
    }

    if (filtered.length === 0) {
        const emptyMsg = currentFilter === 'belum' 
            ? 'Tidak ada permintaan berhalangan yang belum diproses.' 
            : 'Belum ada riwayat permintaan berhalangan.';
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-check-circle"></i>
                <h3>Semua Bersih!</h3>
                <p>${emptyMsg}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => createCardHTML(item)).join('');

    // Attach event listeners ke tiap kartu
    attachCardListeners();
}

function createCardHTML(item) {
    const status = item.status || 'Belum Diproses';
    const isBelum = status.toLowerCase() === 'belum diproses';
    const isSelesai = status.toLowerCase() === 'selesai';
    const isDitolak = status.toLowerCase() === 'ditolak';

    // Badge status (ditampilkan di tab "Semua")
    let statusBadgeHTML = '';
    if (currentFilter === 'semua') {
        let badgeClass = 'belum';
        if (isSelesai) badgeClass = 'selesai';
        if (isDitolak) badgeClass = 'ditolak';
        statusBadgeHTML = `<span class="status-badge ${badgeClass}">${escapeHtml(status)}</span>`;
    }

    // Nama & Catatan Badge
    const nama = escapeHtml(item.nama || 'Pelayan');
    const firstName = nama.split(' ')[0];
    const catatan = escapeHtml(item.catatan || `Catatan ${firstName}`);

    // Link Pelayanan
    const judulPelayanan = escapeHtml(item.judul_pelayanan || 'Pelayanan');
    const jadwalTanggal = escapeHtml(item.jadwal_tanggal || '-');
    const jadwalId = item.id_jadwal || '';

    // Action Bottom Row
    let actionRowHTML = '';
    if (isBelum) {
        // Options dropdown Nama Pengganti
        let optionsHTML = `<option value="" disabled selected>Nama Pengganti</option>`;
        if (akunList && akunList.length > 0) {
            akunList.forEach(akun => {
                // Jangan jadikan orang yang berhalangan sebagai opsi pengganti dirinya sendiri
                if (akun.nama_lengkap !== item.nama) {
                    optionsHTML += `<option value="${escapeHtml(akun.nama_lengkap)}">${escapeHtml(akun.nama_lengkap)} (${escapeHtml(akun.role)})</option>`;
                }
            });
        } else {
            // Default placeholder options jika daftar pengguna kosong
            optionsHTML += `
                <option value="Cloud">Cloud (Worship Leader)</option>
                <option value="metiu">metiu (Pianist / Admin)</option>
                <option value="Jonathan">Jonathan (Singer)</option>
            `;
        }

        actionRowHTML = `
            <div class="card-action-row">
                <div class="select-pengganti-wrap">
                    <select class="select-pengganti" id="select-pengganti-${item.id}">
                        ${optionsHTML}
                    </select>
                </div>
                <button type="button" class="btn-tandai-selesai" data-id="${item.id}">
                    Tandai Selesai
                </button>
                <button type="button" class="btn-tolak" data-id="${item.id}">
                    Tolak
                </button>
            </div>
        `;
    } else if (isSelesai) {
        actionRowHTML = `
            <div class="status-resolved-box selesai">
                <div>
                    <i class="ph ph-check-circle" style="vertical-align: middle; margin-right: 4px;"></i>
                    Selesai &bull; Pengganti: <strong>${escapeHtml(item.nama_pengganti || 'Tidak Ditentukan')}</strong>
                </div>
            </div>
        `;
    } else if (isDitolak) {
        actionRowHTML = `
            <div class="status-resolved-box ditolak">
                <div>
                    <i class="ph ph-x-circle" style="vertical-align: middle; margin-right: 4px;"></i>
                    Permintaan ini Ditolak
                </div>
            </div>
        `;
    }

    return `
        <article class="berhalangan-card" id="card-${item.id}">
            <div class="card-top-row">
                <div class="user-identity">
                    <span class="user-name">${nama}</span>
                    <span class="catatan-badge">${catatan}</span>
                </div>
                ${statusBadgeHTML}
            </div>

            <p class="pelayanan-subtitle">
                Pelayanan: 
                <a href="${jadwalId ? `/detail-jadwal.html?id=${jadwalId}` : '/jadwal'}" class="pelayanan-link" title="Buka Detail Jadwal">
                    ${judulPelayanan} . ${jadwalTanggal}
                </a>
            </p>

            <div class="alasan-box">
                <div class="alasan-label">ALASAN</div>
                <div class="alasan-content">${escapeHtml(item.alasan || '-')}</div>
            </div>

            ${actionRowHTML}
        </article>
    `;
}

// ==========================================
// 3. ACTION EVENT HANDLERS (SELESAI & TOLAK)
// ==========================================

function attachCardListeners() {
    // Tombol Tandai Selesai
    const btnSelesaiList = document.querySelectorAll('.btn-tandai-selesai');
    btnSelesaiList.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const selectElem = document.getElementById(`select-pengganti-${id}`);
            const selectedPengganti = selectElem ? selectElem.value : '';

            if (!selectedPengganti) {
                const proceedWithout = confirm('Anda belum memilih Nama Pengganti. Apakah ingin tetap menandai selesai tanpa pengganti?');
                if (!proceedWithout) {
                    if (selectElem) selectElem.focus();
                    return;
                }
            }

            btn.disabled = true;
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Menyimpan...`;

            try {
                const res = await fetch(`/api/berhalangan/${id}/selesai`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nama_pengganti: selectedPengganti })
                });

                if (!res.ok) throw new Error('Gagal memperbarui status');
                const result = await res.json();

                // Update data lokal
                const targetIndex = berhalanganData.findIndex(item => item.id == id);
                if (targetIndex !== -1) {
                    berhalanganData[targetIndex].status = 'Selesai';
                    berhalanganData[targetIndex].nama_pengganti = selectedPengganti;
                }

                showToast(`Permintaan berhasil diselesaikan!${selectedPengganti ? ' Pengganti: ' + selectedPengganti : ''}`, 'success');
                renderList();
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Tandai Selesai';
            }
        });
    });

    // Tombol Tolak
    const btnTolakList = document.querySelectorAll('.btn-tolak');
    btnTolakList.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmTolak = confirm('Apakah Anda yakin ingin menolak permintaan berhalangan ini?');
            if (!confirmTolak) return;

            btn.disabled = true;
            btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Menolak...`;

            try {
                const res = await fetch(`/api/berhalangan/${id}/tolak`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!res.ok) throw new Error('Gagal menolak permintaan');
                const result = await res.json();

                // Update data lokal
                const targetIndex = berhalanganData.findIndex(item => item.id == id);
                if (targetIndex !== -1) {
                    berhalanganData[targetIndex].status = 'Ditolak';
                }

                showToast('Permintaan berhalangan telah ditolak.', 'success');
                renderList();
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Tolak';
            }
        });
    });
}

// ==========================================
// 4. FILTER TABS
// ==========================================

function initFilterTabs() {
    const btnBelum = document.getElementById('btn-filter-belum');
    const btnSemua = document.getElementById('btn-filter-semua');

    if (btnBelum && btnSemua) {
        btnBelum.addEventListener('click', () => {
            currentFilter = 'belum';
            btnBelum.classList.add('active');
            btnSemua.classList.remove('active');
            renderList();
        });

        btnSemua.addEventListener('click', () => {
            currentFilter = 'semua';
            btnSemua.classList.add('active');
            btnBelum.classList.remove('active');
            renderList();
        });
    }
}

// ==========================================
// 5. MODAL AJUKAN PERMINTAAN
// ==========================================

function initModalEvents() {
    const modal = document.getElementById('modal-ajukan');
    const btnOpen = document.getElementById('btn-open-modal-ajukan');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCancel = document.getElementById('btn-cancel-modal');
    const form = document.getElementById('form-ajukan-berhalangan');

    if (!modal) return;

    const openModal = () => {
        modal.style.display = 'flex';
        // Auto-fill nama jika user saat ini login sebagai pelayan
        if (window.userData && window.userData.nama_lengkap) {
            const inputNama = document.getElementById('input-nama-pelayan');
            if (inputNama && !inputNama.value) {
                inputNama.value = window.userData.nama_lengkap;
            }
        }
    };

    const closeModal = () => {
        modal.style.display = 'none';
        if (form) form.reset();
    };

    if (btnOpen) btnOpen.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Tutup jika klik area latar gelap
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Submit form
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-ajukan');
            const nama = document.getElementById('input-nama-pelayan').value.trim();
            const alasan = document.getElementById('input-alasan').value.trim();
            const selectPelayanan = document.getElementById('select-pelayanan');

            let id_jadwal = null;
            let judul_pelayanan = 'Pelayanan Ibadah';
            let jadwal_tanggal = '-';

            if (selectPelayanan && selectPelayanan.value) {
                id_jadwal = selectPelayanan.value;
                const opt = selectPelayanan.selectedOptions[0];
                if (opt) {
                    judul_pelayanan = opt.getAttribute('data-judul') || 'Pelayanan Ibadah';
                    jadwal_tanggal = opt.getAttribute('data-tanggal') || '-';
                }
            }

            if (!nama || !alasan) {
                alert('Nama dan Alasan wajib diisi!');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Mengirim...`;

            try {
                const res = await fetch('/api/berhalangan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nama,
                        id_jadwal,
                        judul_pelayanan,
                        jadwal_tanggal,
                        alasan
                    })
                });

                if (!res.ok) throw new Error('Gagal mengirim permintaan');
                const result = await res.json();

                if (result.data) {
                    berhalanganData.unshift(result.data);
                }

                closeModal();
                showToast('Permintaan berhalangan berhasil diajukan!', 'success');
                renderList();
            } catch (err) {
                console.error(err);
                alert('Gagal mengirim: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Kirim Permintaan';
            }
        });
    }
}

function populateJadwalSelect() {
    const select = document.getElementById('select-pelayanan');
    if (!select || !jadwalList) return;

    select.innerHTML = '<option value="">Pilih Jadwal Pelayanan...</option>';
    jadwalList.forEach(j => {
        const judul = j.judul || j.tema_pelayanan || 'Pelayanan';
        const tgl = j.tanggal || j.tanggal_pelayanan || '-';
        const opt = document.createElement('option');
        opt.value = j.id || j.id_jadwal || '';
        opt.setAttribute('data-judul', judul);
        opt.setAttribute('data-tanggal', tgl);
        opt.textContent = `${judul} (${tgl})`;
        select.appendChild(opt);
    });
}

// ==========================================
// 6. UTILITY FUNCTIONS
// ==========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'ph-info';
    if (type === 'success') icon = 'ph-check-circle';
    if (type === 'error') icon = 'ph-warning';

    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
