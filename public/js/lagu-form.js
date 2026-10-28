//skrip ini dipakai barengan oleh halaman Tambah Lagu dan Edit Lagu
document.addEventListener('DOMContentLoaded', async () => {
    //inisialisasi auth (pastikan user udah login sebelum form muncul)
    if (window.authReady) {
        await window.authReady; //nungguin sinyal aman dari layout.js
    }

    //ambil ID lagu dari URL (contoh: /edit-lagu?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const songId = urlParams.get('id');

    //nentuin mode form. kalau ada ID-nya berarti lagi 'edit', kalau kosong berarti lagi 'add' (nambah baru)
    const formMode = songId ? 'edit' : 'add';

    //cari tombol simpannya
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        //pasangin aksi pas ditekan: lempar data ke fungsi handleSave
        saveBtn.addEventListener('click', () => handleSave(songId, formMode));
    }

    //kalau masuk mode edit, kita tarik dulu data lama lagunya biar kolom-kolomnya keisi otomatis
    if (formMode === 'edit') {
        await populateForm(songId);
    }
});

//fungsi buat nyedot data lagu lama terus disuntikin ke tiap kolom input
async function populateForm(id) {
    try {
        //panggil API buat ambil detail lagunya
        const res = await fetch(`/api/lagu/${id}`);
        if (!res.ok) throw new Error('Lagu tidak ditemukan');

        const { data: song } = await res.json();

        //kalo lagunya ketemu, masukin satu-satu valuenya ke dalem elemen input HTML-nya
        //kompatibel dengan database baru (judul_lagu, pengarang) maupun alias lama (judul, penyanyi)
        if (song) {
            document.getElementById('inputJudul').value = song.judul_lagu || song.judul || '';
            document.getElementById('inputPenyanyi').value = song.pengarang || song.penyanyi || '';
            document.getElementById('inputKategori').value = song.kategori || '';
            document.getElementById('inputNadaDasar').value = (song.nada_dasar || '').trim();
            document.getElementById('inputLinkYoutube').value = song.link_youtube || '';
            document.getElementById('inputChordLirik').value = song.chord_lirik || '';
        }
    } catch (err) {
        //kalo lagunya nggak ada (atau salah ID), mending lempar balik user ke Bank Lagu
        alert(err.message);
        window.location.href = '/bank-lagu';
    }
}

//fungsi eksekusi pas user ngeklik "Simpan"
async function handleSave(id, mode) {
    //ambil semua teks dari inputan user (.trim() buat ngebuang spasi kosong di awal/akhir kata)
    const judul = document.getElementById('inputJudul').value.trim();
    const penyanyi = document.getElementById('inputPenyanyi').value.trim();
    const kategori = document.getElementById('inputKategori').value;
    const nada_dasar = document.getElementById('inputNadaDasar').value.trim();
    const link_youtube = document.getElementById('inputLinkYoutube').value.trim();
    const chord_lirik = document.getElementById('inputChordLirik').value.trim();

    //validasi minim saja, minimal judul gak kosong!
    if (!judul) {
        alert('Judul lagu wajib diisi!');
        return; //setop, jangan lanjut nyimpen
    }

    //bungkus semua datanya ke dalam satu paket (payload)
    //kirim format database baru sekaligus alias lama biar serbaguna
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

    //tentukan URL sama metode HTTP-nya
    //kalau edit pakai rute ber-ID dan metode PUT (update)
    //kalau nambah pakai rute biasa dan metode POST (create)
    const url = mode === 'edit' ? `/api/lagu/${id}` : '/api/lagu';
    const method = mode === 'edit' ? 'PUT' : 'POST';

    //efek visual pas lagi loading (biar user ga dobel klik tombol simpannya)
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    try {
        //panggil API pake data JSON kita
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) //data paketnya diubah jadi string JSON
        });

        const result = await response.json();
        //kalau server bilang gagal, lempar errornya
        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan lagu');
        }

        //kalau sukses nyimpen...
        if (mode === 'edit') {
            //kalau diedit, arahin ke halaman detail lagunya biar langsung keliatan hasilnya
            window.location.href = `/detail-lagu?id=${id}`;
        } else {
            //kalau baru ditambahin, arahin ke halaman daftar bank lagu
            window.location.href = '/bank-lagu';
        }

    } catch (err) {
        //kalau proses nyimpen error (misal internet mati), kasih tau user
        alert(err.message);
        //nyalain lagi tombol simpannya biar dia bisa coba ulang
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}
