//routes/laguRoutes.js
const express = require('express');
const router = express.Router();
//koneksi ke client database supabase
const supabase = require('../config/supabase');

//fungsi bantu buat merapikan format objek lagu dari database agar konsisten dipakai di frontend
function normalizeSong(song) {
    if (!song) return null;
    //hapus sisa spasi pada kolom nada_dasar yang bertipe char(2) di database
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

//fungsi bantu buat mengambil dan membersihkan data input lagu dari request body
function parseSongPayload(body = {}) {
    return {
        judul_lagu: (body.judul_lagu || body.judul || '').trim(),
        pengarang: (body.pengarang || body.penyanyi || '').trim(),
        kategori: (body.kategori || 'Worship').trim(),
        //batasi maksimal 2 karakter sesuai ukuran kolom char(2) di tabel lagu
        nada_dasar: (body.nada_dasar || '').trim().substring(0, 2),
        link_youtube: (body.link_youtube || '').trim(),
        chord_lirik: body.chord_lirik || ''
    };
}

//endpoint GET /api/lagu untuk mengambil seluruh daftar lagu
router.get('/', async (req, res) => {
    try {
        //ambil semua baris dari tabel lagu diurutkan sesuai abjad judul_lagu
        const { data, error } = await supabase
            .from('lagu')
            .select('*')
            .order('judul_lagu', { ascending: true });

        if (error) throw error;

        //normalisasi semua data lagu sebelum dikirim ke frontend
        const normalizedData = (data || []).map(normalizeSong);
        res.status(200).json({ success: true, data: normalizedData });
    } catch (err) {
        console.error('[Lagu API Error] Gagal ambil semua lagu:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//endpoint GET /api/lagu/:id untuk mengambil detail satu lagu berdasarkan id_lagu
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        //cari satu lagu yang memiliki id_lagu sesuai parameter URL
        const { data, error } = await supabase
            .from('lagu')
            .select('*')
            .eq('id_lagu', id)
            .single();

        if (error) {
            //kalau data lagu tidak ditemukan di database, kirim status 404
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'Lagu tidak ditemukan' });
            }
            throw error;
        }

        //kirim data detail lagu yang sudah dinormalisasi
        res.status(200).json({ success: true, data: normalizeSong(data) });
    } catch (err) {
        console.error(`[Lagu API Error] Gagal ambil detail lagu id ${id}:`, err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//endpoint POST /api/lagu untuk menyimpan lagu baru ke database
router.post('/', async (req, res) => {
    //ambil data dari form dan pastikan judul lagu sudah diisi
    const payload = parseSongPayload(req.body);
    if (!payload.judul_lagu) {
        return res.status(400).json({ success: false, message: 'Judul lagu wajib diisi!' });
    }

    try {
        //masukkan data lagu baru ke tabel lagu di supabase
        const { data, error } = await supabase.from('lagu').insert([payload]).select();
        if (error) throw error;

        //kembalikan response sukses beserta data lagu yang baru dibuat
        res.status(201).json({
            success: true,
            message: 'Lagu berhasil ditambahkan',
            data: normalizeSong(data[0])
        });
    } catch (err) {
        console.error('[Lagu API Error] Gagal insert lagu baru:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//endpoint PUT /api/lagu/:id untuk memperbarui data lagu yang sudah ada
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    //ambil data perubahan dari body request dan validasi judul lagu
    const payload = parseSongPayload(req.body);
    if (!payload.judul_lagu) {
        return res.status(400).json({ success: false, message: 'Judul lagu wajib diisi!' });
    }

    try {
        //update baris lagu di database berdasarkan id_lagu
        const { data, error } = await supabase
            .from('lagu')
            .update(payload)
            .eq('id_lagu', id)
            .select();

        if (error) throw error;
        //kalau tidak ada baris yang terupdate, berarti id_lagu tidak ditemukan
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'Lagu tidak ditemukan untuk diperbarui' });
        }

        //kirimkan data lagu terbaru setelah berhasil diperbarui
        res.status(200).json({
            success: true,
            message: 'Lagu berhasil diperbarui',
            data: normalizeSong(data[0])
        });
    } catch (err) {
        console.error(`[Lagu API Error] Gagal update lagu id ${id}:`, err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

//endpoint DELETE /api/lagu/:id untuk menghapus lagu dari database
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        //hapus dulu relasi lagu ini di tabel jadwal_lagu supaya tidak melanggar foreign key
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
