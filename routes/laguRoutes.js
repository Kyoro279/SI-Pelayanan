//routes/laguRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase'); //menghubungkan ke database Supabase yang baru

//helper untuk normalisasi objek lagu dari database Supabase baru.
//di database baru, kolom-kolomnya punya nama resmi:
//- id_lagu (integer auto-increment)
//- judul_lagu (varchar judul)
//- pengarang (varchar penyanyi/pencipta)
//- kategori (varchar misal 'Worship' / 'Praise')
//- nada_dasar (character(2), di postgres suka ada sisa spasi 'G ', jadi wajib di-.trim())
//- link_youtube (text URL video)
//- chord_lirik (text isi chord & lirik)
//- created_at (timestamp)
//supaya frontend lama maupun baru tetap saling paham dan nggak bentrok,
//kita sediakan dua-duanya (id & id_lagu, judul & judul_lagu, penyanyi & pengarang)!
function normalizeSong(song) {
    if (!song) return null;
    const nada = (song.nada_dasar || '').trim();
    return {
        id_lagu: song.id_lagu,
        id: song.id_lagu,
        judul_lagu: song.judul_lagu || '',
        judul: song.judul_lagu || '',
        pengarang: song.pengarang || '',
        penyanyi: song.pengarang || '',
        kategori: song.kategori || 'Worship',
        nada_dasar: nada,
        link_youtube: song.link_youtube || '',
        chord_lirik: song.chord_lirik || '',
        created_at: song.created_at
    };
}

//mengambil seluruh daftar lagu
//fungsi ini mengambil semua data lagu dari tabel 'lagu' di database baru.
//diurutkan berdasarkan 'judul_lagu' secara ascending (A-Z).
//dipanggil di: public/js/lagu.js (fetchSongs) dan public/js/detail-jadwal.js
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('lagu')
            .select('*')
            .order('judul_lagu', { ascending: true });

        if (error) throw error;

        //normalisasi setiap baris data lagu
        const normalizedData = (data || []).map(normalizeSong);
        res.status(200).json({ success: true, data: normalizedData });
    } catch (err) {
        console.error('[Lagu API Error] Gagal ambil semua lagu:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//mengambil detail 1 lagu berdasarkan ID
//di database baru, kolom identitas uniknya adalah 'id_lagu'.
//dipanggil di: public/js/detail-lagu.js dan public/js/lagu-form.js
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('lagu')
            .select('*')
            .eq('id_lagu', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'Lagu tidak ditemukan' });
            }
            throw error;
        }

        res.status(200).json({ success: true, data: normalizeSong(data) });
    } catch (err) {
        console.error(`[Lagu API Error] Gagal ambil detail lagu id ${id}:`, err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//menambahkan lagu baru
//menerima payload dari formulir tambah lagu.
//kolom 'nada_dasar' di DB baru bertipe character(2), jadi kita pangkas maksimal 2 karakter (misal 'C#', 'Bb', 'G').
//dipanggil di: public/js/lagu-form.js mode 'add'
router.post('/', async (req, res) => {
    const body = req.body || {};
    const judul_lagu = (body.judul_lagu || body.judul || '').trim();
    const pengarang = (body.pengarang || body.penyanyi || '').trim();
    const kategori = (body.kategori || 'Worship').trim();
    const rawKey = (body.nada_dasar || '').trim();
    const nada_dasar = rawKey.substring(0, 2); //jaga agar tidak melebihi kapasitas char(2)
    const link_youtube = (body.link_youtube || '').trim();
    const chord_lirik = body.chord_lirik || '';

    //validasi dasar: judul wajib diisi
    if (!judul_lagu) {
        return res.status(400).json({ success: false, message: 'Judul lagu wajib diisi!' });
    }

    try {
        const { data, error } = await supabase.from('lagu').insert([
            { judul_lagu, pengarang, kategori, nada_dasar, link_youtube, chord_lirik }
        ]).select();

        if (error) throw error;
        const newSong = normalizeSong(data[0]);
        res.status(201).json({ success: true, message: 'Lagu berhasil ditambahkan', data: newSong });
    } catch (err) {
        console.error('[Lagu API Error] Gagal insert lagu baru:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//mengedit / memperbarui data lagu
//mengubah kolom judul_lagu, pengarang, kategori, nada_dasar, dll berdasarkan 'id_lagu'.
//dipanggil di: public/js/lagu-form.js mode 'edit'
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const judul_lagu = (body.judul_lagu || body.judul || '').trim();
    const pengarang = (body.pengarang || body.penyanyi || '').trim();
    const kategori = (body.kategori || 'Worship').trim();
    const rawKey = (body.nada_dasar || '').trim();
    const nada_dasar = rawKey.substring(0, 2);
    const link_youtube = (body.link_youtube || '').trim();
    const chord_lirik = body.chord_lirik || '';

    if (!judul_lagu) {
        return res.status(400).json({ success: false, message: 'Judul lagu wajib diisi!' });
    }

    try {
        const { data, error } = await supabase.from('lagu').update({
            judul_lagu,
            pengarang,
            kategori,
            nada_dasar,
            link_youtube,
            chord_lirik
        }).eq('id_lagu', id).select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'Lagu tidak ditemukan untuk diperbarui' });
        }

        const updatedSong = normalizeSong(data[0]);
        res.status(200).json({ success: true, message: 'Lagu berhasil diperbarui', data: updatedSong });
    } catch (err) {
        console.error(`[Lagu API Error] Gagal update lagu id ${id}:`, err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//menghapus lagu secara permanen
//sebelum menghapus lagu dari tabel 'lagu', kita bersihkan juga relasi lagunya
//di tabel 'jadwal_lagu' supaya tidak menyisakan data yatim di jadwal.
//dipanggil di: public/js/lagu.js dan public/js/detail-lagu.js
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        //hapus dulu relasi lagu dari jadwal_lagu jika ada
        await supabase.from('jadwal_lagu').delete().eq('id_lagu', id);

        //hapus data lagu utama dari tabel lagu
        const { error } = await supabase.from('lagu').delete().eq('id_lagu', id);
        if (error) throw error;

        res.status(200).json({ success: true, message: 'Lagu berhasil dihapus' });
    } catch (err) {
        console.error(`[Lagu API Error] Gagal hapus lagu id ${id}:`, err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
