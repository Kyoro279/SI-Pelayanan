// public/js/berhalangan.js

let allChats = [];
let currentFilter = 'semua'; // 'semua' | 'proses' | 'selesai'
let selectedChatKey = null;  // format: `${id_jadwal}_${id_pengguna}`

const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function getThreadKey(item) {
    if (!item) return '';
    return `${item.id_jadwal}_${item.id_pengguna}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.authReady) {
        await window.authReady;
    }

    // Proteksi Hak Akses: Halaman Berhalangan hanya untuk Worship Planner (dan Admin)
    const role = window.userData ? (window.userData.role || '').toLowerCase() : (window.isSuperAdmin ? 'admin' : 'guest');
    const canAccessBerhalangan = window.isSuperAdmin || role === 'worship planner' || role === 'wp' || role === 'admin';
    if (!canAccessBerhalangan) {
        window.location.href = '/dashboard';
        return;
    }

    initTabs();
    await loadChats();
});

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter') || 'semua';
            renderAll();
        });
    });
}

async function loadChats() {
    const inboxContainer = document.getElementById('inbox-list-container');
    try {
        const res = await fetch('/api/berhalangan');
        if (!res.ok) throw new Error('Gagal memuat data berhalangan');
        const json = await res.json();
        allChats = json.data || [];
        renderAll();
    } catch (err) {
        console.error('Error loadChats:', err);
        if (inboxContainer) {
            inboxContainer.innerHTML = `<div class="empty-inbox">Gagal memuat data: ${escapeHtml(err.message)}</div>`;
        }
    }
}

function updateTabBadges() {
    const totalSemua = allChats.length;
    const totalProses = allChats.filter(c => c.status_penanganan !== 'Selesai').length;
    const totalSelesai = allChats.filter(c => c.status_penanganan === 'Selesai').length;

    const setBadge = (id, count) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    };

    setBadge('badge-semua', totalSemua);
    setBadge('badge-proses', totalProses);
    setBadge('badge-selesai', totalSelesai);
}

function getFilteredChats() {
    if (currentFilter === 'proses') {
        return allChats.filter(c => c.status_penanganan !== 'Selesai');
    }
    if (currentFilter === 'selesai') {
        return allChats.filter(c => c.status_penanganan === 'Selesai');
    }
    return allChats;
}

function renderAll() {
    updateTabBadges();
    const filtered = getFilteredChats();

    if (filtered.length === 0) {
        selectedChatKey = null;
    } else if (!selectedChatKey || !filtered.some(c => getThreadKey(c) === selectedChatKey)) {
        selectedChatKey = getThreadKey(filtered[0]);
    }

    renderInboxList(filtered);
    renderChatPanel();
}

function renderInboxList(filtered) {
    const container = document.getElementById('inbox-list-container');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-inbox">Belum ada pesan berhalangan pada kategori ini.</div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isSelesai = item.status_penanganan === 'Selesai';
        const key = getThreadKey(item);
        const isActive = key === selectedChatKey;
        const statusClass = isSelesai ? 'selesai' : 'proses';
        const statusLabel = isSelesai ? 'Selesai' : 'Sedang Proses';

        return `
            <div class="inbox-item ${isActive ? 'active' : ''}" data-key="${escapeHtml(key)}">
                <div class="inbox-top">
                    <span class="inbox-name">${escapeHtml(item.nama)}</span>
                    <span class="inbox-status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="inbox-pelayanan">
                    Pelayanan: ${escapeHtml(item.judul_pelayanan)} &bull; ${escapeHtml(item.jadwal_tanggal)}
                </div>
                <div class="inbox-snippet">${escapeHtml(item.isi_pesan)}</div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.inbox-item').forEach(el => {
        el.addEventListener('click', () => {
            selectedChatKey = el.getAttribute('data-key');
            renderInboxList(filtered);
            renderChatPanel();
        });
    });
}

function buildMessagesHTML(chat) {
    const senderInitials = getInitials(chat.nama);
    const messages = Array.isArray(chat.messages) && chat.messages.length > 0
        ? chat.messages
        : [
            ...(chat.isi_pesan && chat.isi_pesan !== '-' ? [{
                sender: 'pelayan',
                nama: chat.nama,
                text: chat.isi_pesan,
                timestamp: chat.timestamp_kirim
            }] : []),
            ...(chat.pesan_balasan ? [{
                sender: 'wp',
                nama: 'Worship Planner',
                text: chat.pesan_balasan,
                timestamp: chat.timestamp_balas || chat.timestamp_kirim,
                status_baca: chat.status_baca
            }] : [])
        ];

    let lastDateStr = '';
    const htmlParts = [];

    messages.forEach(msg => {
        const dateStr = formatTanggal(msg.timestamp);
        const timeStr = formatJam(msg.timestamp);

        if (dateStr && dateStr !== lastDateStr) {
            htmlParts.push(`
                <div class="chat-date-separator">
                    <span>${escapeHtml(dateStr)}</span>
                </div>
            `);
            lastDateStr = dateStr;
        }

        if (msg.sender === 'wp') {
            const statusBacaStr = formatStatusBaca(msg.status_baca);
            htmlParts.push(`
                <div class="chat-row">
                    <div class="chat-avatar">WP</div>
                    <div class="chat-bubble dark">
                        <div class="bubble-sender">Worship Planner</div>
                        <div class="bubble-text">${escapeHtml(msg.text)}</div>
                        <div class="bubble-footer">
                            <span>${escapeHtml(timeStr)}</span>
                            <span class="read-badge">${escapeHtml(statusBacaStr)}</span>
                        </div>
                    </div>
                </div>
            `);
        } else {
            htmlParts.push(`
                <div class="chat-row">
                    <div class="chat-avatar">${escapeHtml(senderInitials)}</div>
                    <div class="chat-bubble light">
                        <div class="bubble-sender">${escapeHtml(msg.nama || chat.nama)}</div>
                        <div class="bubble-text">${escapeHtml(msg.text)}</div>
                        <div class="bubble-footer">
                            <span>${escapeHtml(timeStr)}</span>
                        </div>
                    </div>
                </div>
            `);
        }
    });

    return htmlParts.join('');
}

function renderChatPanel() {
    const panel = document.getElementById('chat-panel-container');
    if (!panel) return;

    const chat = allChats.find(c => getThreadKey(c) === selectedChatKey);
    if (!chat) {
        panel.innerHTML = `<div class="empty-chat">Tidak ada percakapan yang dipilih.</div>`;
        return;
    }

    const isSelesai = chat.status_penanganan === 'Selesai';
    const statusClass = isSelesai ? 'selesai' : 'proses';
    const statusLabel = isSelesai ? 'Selesai' : 'Sedang Proses';
    const firstName = (chat.nama || 'Pelayan').trim().split(' ')[0];

    const messagesHTML = buildMessagesHTML(chat);

    const actionBtnsHTML = !isSelesai
        ? `
            <div class="reply-actions">
                <button type="button" class="btn-cari-pengganti" id="btn-cari-pengganti">Cari Pengganti</button>
                <button type="button" class="btn-selesai-izin" id="btn-selesai-izin">Selesai</button>
            </div>
        `
        : '';

    panel.innerHTML = `
        <div>
            <div class="chat-header">
                <div>
                    <h2 class="chat-header-title">Percakapan</h2>
                    <p class="chat-header-subtitle">${escapeHtml(chat.nama)} &bull; ${escapeHtml(chat.judul_pelayanan)}</p>
                </div>
                <span class="chat-status-pill ${statusClass}">${statusLabel}</span>
            </div>

            <div class="chat-messages">
                ${messagesHTML}
            </div>
        </div>

        <div class="chat-reply-box">
            <label class="reply-label" for="input-balasan-wp">Balas</label>
            <div class="reply-textarea-wrapper">
                <textarea id="input-balasan-wp" class="reply-textarea" placeholder="Tulis balasan untuk ${escapeHtml(firstName)}..."></textarea>
                <button type="button" class="btn-send-chat" id="btn-kirim-balas" title="Kirim Balasan (Enter)">
                    <i class="ph-fill ph-paper-plane-right"></i>
                </button>
            </div>
            ${actionBtnsHTML}
        </div>
    `;

    const btnBalas = document.getElementById('btn-kirim-balas');
    const btnCariPengganti = document.getElementById('btn-cari-pengganti');
    const btnSelesaiIzin = document.getElementById('btn-selesai-izin');
    const inputBalasan = document.getElementById('input-balasan-wp');

    async function handleSendBalasan() {
        if (!inputBalasan || (btnBalas && btnBalas.disabled)) return;
        const text = inputBalasan.value.trim();
        if (!text) {
            showToast('Tulis pesan balasan terlebih dahulu.', 'error');
            inputBalasan.focus();
            return;
        }

        if (btnBalas) btnBalas.disabled = true;

        try {
            const res = await fetch(`/api/berhalangan/${chat.id_chat}/balas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pesan_balasan: text,
                    id_penindaklanjut: window.userData ? window.userData.id_pengguna : null
                })
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.message || 'Gagal mengirim balasan');
            }

            const idx = allChats.findIndex(c => getThreadKey(c) === getThreadKey(chat));
            if (idx !== -1 && result.data) {
                allChats[idx] = result.data;
            }

            showToast('Balasan berhasil dikirim!', 'success');
            renderAll();
        } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
            if (btnBalas) btnBalas.disabled = false;
        }
    }

    if (btnBalas) {
        btnBalas.addEventListener('click', handleSendBalasan);
    }

    if (inputBalasan) {
        inputBalasan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendBalasan();
            }
        });
    }

    if (btnCariPengganti) {
        btnCariPengganti.addEventListener('click', () => {
            window.location.href = `/jadwal?edit_id=${chat.id_jadwal}&from=berhalangan&chat_id=${chat.id_chat}`;
        });
    }

    if (btnSelesaiIzin) {
        btnSelesaiIzin.addEventListener('click', async () => {
            btnSelesaiIzin.disabled = true;
            btnSelesaiIzin.textContent = 'Memproses...';

            try {
                const res = await fetch(`/api/berhalangan/${chat.id_chat}/selesai`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_penindaklanjut: window.userData ? window.userData.id_pengguna : null
                    })
                });

                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || 'Gagal menyelesaikan status izin');
                }

                const idx = allChats.findIndex(c => getThreadKey(c) === getThreadKey(chat));
                if (idx !== -1 && result.data) {
                    allChats[idx] = result.data;
                }

                showToast('Case izin berhalangan selesai ditangani!', 'success');
                renderAll();
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
                btnSelesaiIzin.disabled = false;
                btnSelesaiIzin.textContent = 'Selesai';
            }
        });
    }
}

function getInitials(name) {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
}

function formatTanggal(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const day = d.getDate();
    const month = BULAN_INDONESIA[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

function formatJam(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function formatStatusBaca(statusBaca) {
    if (!statusBaca || statusBaca.toLowerCase() === 'belum dibaca') {
        return 'Belum Dibaca';
    }
    return 'Dibaca';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
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
