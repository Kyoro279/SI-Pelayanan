//skrip ini dipakai bersama oleh halaman tambah lagu dan edit lagu
document.addEventListener('DOMContentLoaded', async () => {
    //pastikan pengecekan login dari layout.js selesai dulu
    if (window.authReady) {
        await window.authReady;
    }

    //ambil parameter id dari URL untuk nentuin mode edit atau tambah baru
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id');
    const formMode = songId ? 'edit' : 'add';

    //pasang event klik pada tombol simpan
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => handleSave(songId, formMode));
    }

    //kalau lagi di mode edit, tarik data lagu lama buat ngisi form otomatis
    if (formMode === 'edit') {
        await populateForm(songId);
    }
});

//fungsi buat ngambil data lagu dari backend lalu dimasukin ke kolom-kolom input form
async function populateForm(id) {
    try {
        //panggil API detail lagu berdasarkan ID
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');

        const { data: song } = await res.json();
        //masukin nilai dari database ke masing-masing elemen input di HTML
        if (song) {
            document.getElementById('inputJudul').value = song.judul_lagu || song.judul || '';
            document.getElementById('inputPenyanyi').value = song.pengarang || song.penyanyi || '';
            document.getElementById('inputKategori').value = song.kategori || '';
            document.getElementById('inputNadaDasar').value = (song.nada_dasar || '').trim();
            document.getElementById('inputLinkYoutube').value = song.link_youtube || '';
            document.getElementById('inputChordLirik').value = song.chord_lirik || '';
        }
    } catch (err) {
        //kalau gagal atau ID tidak ditemukan, kembalikan ke halaman bank lagu
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

//fungsi buat nyimpen data lagu ke backend (baik tambah baru maupun update)
async function handleSave(id, mode) {
    //ambil semua nilai yang diketik user dari form input
    const judul = document.getElementById('inputJudul').value.trim();
    const penyanyi = document.getElementById('inputPenyanyi').value.trim();
    const kategori = document.getElementById('inputKategori').value;
    const nada_dasar = document.getElementById('inputNadaDasar').value.trim();
    const link_youtube = document.getElementById('inputLinkYoutube').value.trim();
    //jangan pakai trim() di awal supaya spasi penempatan chord di baris pertama tidak hilang
    const chord_lirik = document.getElementById('inputChordLirik').value.replace(/^\n+|\s+$/g, '');

    //validasi wajib: judul lagu tidak boleh kosong
    if (!judul) {
        alert('Judul lagu wajib diisi!');
        return;
    }

    //susun objek data yang mau dikirim ke server
    const payload = {
        judul,
        judul_lagu: judul,
        penyanyi,
        pengarang: penyanyi,
        kategori,
        nada_dasar,
        link_youtube,
        chord_lirik
    };

    //tentukan endpoint URL dan method HTTP sesuai mode form
    const url = mode === 'edit' ? `/api/lagu/${id}` : '/api/lagu';
    const method = mode === 'edit' ? 'PUT' : 'POST';

    //nonaktifkan tombol simpan sementara supaya tidak diklik berkali-kali
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    try {
        //kirim data lagu ke backend dalam format JSON
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan lagu');
        }

        //arahin balik ke detail lagu kalau edit, atau ke daftar bank lagu kalau tambah baru
        window.location.href = mode === 'edit' ? `/detail-lagu?id=${id}` : '/bank-lagu';
    } catch (err) {
        //tampilkan pesan error dan aktifkan kembali tombol simpan jika gagal
        alert(err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}
