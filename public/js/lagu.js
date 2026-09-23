// public/js/lagu.js

let allSongs = [];
let canManageLagu = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth & Role
    await initAuthPermissions();

    // 2. Setup Event Listeners
    setupEventListeners();

    // 3. Fetch data lagu
    await fetchSongs();
});

/**
 * Cek autentikasi dan hak akses role
 */
async function initAuthPermissions() {
    if (window.authReady) {
        await window.authReady;
    }

    const role = window.userData ? window.userData.role : (window.isSuperAdmin ? 'Admin' : 'Guest');
    canManageLagu = window.isSuperAdmin || role === 'Admin' || role === 'Music Director';

    const btnTambah = document.querySelector('.btn-primary');
    if (btnTambah && !canManageLagu) {
        btnTambah.style.display = 'none';
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    if (searchInput) {
        searchInput.addEventListener('input', filterSongs);
    }
    if (filterCategory) {
        filterCategory.addEventListener('change', filterSongs);
    }
}

async function fetchSongs() {
    const songGrid = document.getElementById('songGrid');
    const subtitle = document.querySelector('.subtitle');

    if (songGrid) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                <i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i>
                <p>Memuat data lagu...</p>
            </div>
        `;
    }

    try {
        const response = await fetch('/api/lagu');
        if (!response.ok) throw new Error('Gagal mengambil data lagu');

        const result = await response.json();
        allSongs = result.data || [];

        renderSongs(allSongs);

        if (subtitle) {
            subtitle.textContent = `${allSongs.length} Lagu Tersedia`;
        }
    } catch (error) {
        console.error('Error fetching songs:', error);
        if (songGrid) {
            songGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ef4444;">
                    <i class="ph ph-warning-circle" style="font-size: 2rem;"></i>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

function renderSongs(songs) {
    const songGrid = document.getElementById('songGrid');
    if (!songGrid) return;

    if (songs.length === 0) {
        songGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
                <i class="ph ph-music-notes-simple" style="font-size: 3rem;"></i>
                <p style="margin-top: 10px;">Belum ada lagu yang sesuai.</p>
            </div>
        `;
        return;
    }

    songGrid.innerHTML = '';

    songs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-category', song.kategori || 'Worship');
        card.style.cursor = 'pointer';
        
        // Klik card untuk masuk ke detail
        card.addEventListener('click', () => {
            window.location.href = `/detail-lagu?id=${song.id}`;
        });

        const key = song.nada_dasar ? song.nada_dasar : '-';

        card.innerHTML = `
            <div class="top-section">
                <div class="card-icon">
                    <i class="ph-fill ph-music-note"></i>
                </div>
                <div class="card-key">${escapeHtml(key)}</div>
            </div>
            <div class="bottom-section">
                <div class="card-details">
                    <h3 class="song-title">${escapeHtml(song.judul)}</h3>
                    <p class="song-artist">${escapeHtml(song.penyanyi || 'Unknown Artist')}</p>
                </div>
                ${canManageLagu ? `
                <button class="btn-delete" title="Hapus Lagu">
                    <i class="ph-bold ph-trash"></i>
                </button>
                ` : ''}
            </div>
        `;

        // Event listener hapus
        const btnDelete = card.querySelector('.btn-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDelete(song.id, song.judul);
            });
        }

        songGrid.appendChild(card);
    });
}

function filterSongs() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const selectedCategory = filterCategory ? filterCategory.value : 'all';

    const filtered = allSongs.filter(song => {
        const title = (song.judul || '').toLowerCase();
        const artist = (song.penyanyi || '').toLowerCase();
        const category = song.kategori || 'Worship';

        const matchesSearch = title.includes(searchTerm) || artist.includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    renderSongs(filtered);
}

async function confirmDelete(id, judul) {
    const isConfirm = confirm(`Apakah Anda yakin ingin menghapus lagu "${judul}"?`);
    if (!isConfirm) return;

    try {
        const res = await fetch(`/api/lagu/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal menghapus lagu');
        
        // Refresh
        await fetchSongs();
    } catch (err) {
        alert('Gagal menghapus lagu: ' + err.message);
    }
}

/**
 * Helper escape HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
