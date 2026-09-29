// Skrip ini dipakai barengan oleh halaman Tambah Lagu dan Edit Lagu
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inisialisasi Auth (Pastikan user udah login sebelum form muncul)
    if (window.authReady) {
        await window.authReady; // Nungguin sinyal aman dari layout.js
    }

    // Ambil ID lagu dari URL (contoh: /edit-lagu?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id');

    // Nentuin mode form. Kalau ada ID-nya berarti lagi 'edit', kalau kosong berarti lagi 'add' (nambah baru)
    const formMode = songId ? 'edit' : 'add';

    // Cari tombol simpannya
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        // Pasangin aksi pas ditekan: lempar data ke fungsi handleSave
        saveBtn.addEventListener('click', () => handleSave(songId, formMode));
    }

    // Kalau masuk mode edit, kita tarik dulu data lama lagunya biar kolom-kolomnya keisi otomatis
    if (formMode === 'edit') {
        await populateForm(songId);
    }
});

// Fungsi buat nyedot data lagu lama terus disuntikin ke tiap kolom input
async function populateForm(id) {
    try {
        // Panggil API buat ambil detail lagunya
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');

        const { data: song } = await res.json();

        // Kalo lagunya ketemu, masukin satu-satu valuenya ke dalem elemen input HTML-nya
        if (song) {
            document.getElementById('inputJudul').value = song.judul || '';
            document.getElementById('inputPenyanyi').value = song.penyanyi || '';
            document.getElementById('inputKategori').value = song.kategori || '';
            document.getElementById('inputNadaDasar').value = song.nada_dasar || '';
            document.getElementById('inputLinkYoutube').value = song.link_youtube || '';
            document.getElementById('inputChordLirik').value = song.chord_lirik || '';
        }
    } catch (err) {
        // Kalo lagunya nggak ada (atau salah ID), mending lempar balik user ke Bank Lagu
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

// Fungsi eksekusi pas user ngeklik "Simpan"
async function handleSave(id, mode) {
    // 1. Ambil semua teks dari inputan user (.trim() buat ngebuang spasi kosong di awal/akhir kata)
    const judul = document.getElementById('inputJudul').value.trim();
    const penyanyi = document.getElementById('inputPenyanyi').value.trim();
    const kategori = document.getElementById('inputKategori').value;
    const nada_dasar = document.getElementById('inputNadaDasar').value;
    const link_youtube = document.getElementById('inputLinkYoutube').value.trim();
    const chord_lirik = document.getElementById('inputChordLirik').value.trim();

    // 2. Validasi minim saja, minimal judul gak kosong!
    if (!judul) {
        alert('Judul lagu wajib diisi!');
        return; // Setop, jangan lanjut nyimpen
    }

    // Bungkus semua datanya ke dalam satu paket (payload)
    const payload = { judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik };

    // Tentukan URL sama Metode HTTP-nya
    // Kalau edit pakai rute ber-ID dan metode PUT (update)
    // Kalau nambah pakai rute biasa dan metode POST (create)
    const url = mode === 'edit' ? `/api/lagu/${id}` : '/api/lagu';
    const method = mode === 'edit' ? 'PUT' : 'POST';

    // 3. Efek visual pas lagi loading (biar user ga dobel klik tombol simpannya)
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    try {
        // Panggil API pake data JSON kita
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) // Data paketnya diubah jadi string JSON
        });

        const result = await response.json();
        // Kalau server bilang gagal, lempar errornya
        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan lagu');
        }

        // Kalau sukses nyimpen...
        if (mode === 'edit') {
            // Kalau diedit, arahin ke halaman detail lagunya biar langsung keliatan hasilnya
            window.location.href = `/detail-lagu?id=${id}`;
        } else {
            // Kalau baru ditambahin, arahin ke halaman daftar bank lagu
            window.location.href = '/bank-lagu';
        }

    } catch (err) {
        // Kalau proses nyimpen error (misal internet mati), kasih tau user
        alert(err.message);
        // Nyalain lagi tombol simpannya biar dia bisa coba ulang
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}
