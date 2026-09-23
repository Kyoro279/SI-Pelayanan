// public/js/lagu-form.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth
    if (window.authReady) {
        await window.authReady;
    }

    // Ambil ID dari URL (untuk mode edit)
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id');

    const formMode = songId ? 'edit' : 'add';

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => handleSave(songId, formMode));
    }

    if (formMode === 'edit') {
        // Mode Edit: Ambil data lagu dan populate form
        await populateForm(songId);
    }
});

async function populateForm(id) {
    try {
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');
        const { data: song } = await res.json();

        if (song) {
            document.getElementById('inputJudul').value = song.judul || '';
            document.getElementById('inputPenyanyi').value = song.penyanyi || '';
            document.getElementById('inputKategori').value = song.kategori || '';
            document.getElementById('inputNadaDasar').value = song.nada_dasar || '';
            document.getElementById('inputLinkYoutube').value = song.link_youtube || '';
            document.getElementById('inputChordLirik').value = song.chord_lirik || '';
        }
    } catch (err) {
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

async function handleSave(id, mode) {
    const judul = document.getElementById('inputJudul').value.trim();
    const penyanyi = document.getElementById('inputPenyanyi').value.trim();
    const kategori = document.getElementById('inputKategori').value;
    const nada_dasar = document.getElementById('inputNadaDasar').value;
    const link_youtube = document.getElementById('inputLinkYoutube').value.trim();
    const chord_lirik = document.getElementById('inputChordLirik').value.trim();

    if (!judul) {
        alert('Judul lagu wajib diisi!');
        return;
    }

    const payload = { judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik };
    const url = mode === 'edit' ? `/api/lagu/${id}` : '/api/lagu';
    const method = mode === 'edit' ? 'PUT' : 'POST';

    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan lagu');
        }

        if (mode === 'edit') {
            window.location.href = `/detail-lagu?id=${id}`;
        } else {
            window.location.href = '/bank-lagu';
        }

    } catch (err) {
        alert(err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}
