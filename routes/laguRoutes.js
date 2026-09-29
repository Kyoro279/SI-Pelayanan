// routes/laguRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase'); // Menghubungkan ke database Supabase

/**
 * 1. GET: Mengambil seluruh daftar lagu
 * Fungsi ini digunakan untuk mengambil semua data lagu dari database.
 * Dipanggil di: public/js/lagu.js (baris ~28 dalam fungsi fetchSongs())
 * Alur kerja: Mengakses tabel 'lagu', mengambil semua kolom (*), lalu mengurutkannya berdasarkan 'judul' secara ascending (A-Z).
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('lagu').select('*').order('judul', { ascending: true });
        if (error) throw error; // Jika ada error dari database, lemparkan ke catch
        res.status(200).json({ success: true, data }); // Kembalikan data dalam format JSON
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 2. GET: Mengambil detail lagu berdasarkan ID
 * Fungsi ini mengambil satu lagu spesifik berdasarkan ID-nya.
 * Dipanggil di: public/js/detail-lagu.js (baris ~22 dalam fungsi fetchDetailLagu())
 *               public/js/lagu-form.js (baris ~26 dalam fungsi populateForm() untuk edit lagu)
 * Alur kerja: Menangkap parameter 'id' dari URL, lalu mencari di tabel 'lagu' di mana kolom 'id' sama dengan id tersebut.
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from('lagu').select('*').eq('id', id).single();
        if (error) {
            if(error.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'Lagu tidak ditemukan' });
            }
            throw error;
        }
        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 3. POST: Menambahkan lagu baru
 * Fungsi ini digunakan ketika user mengisi form tambah lagu dan menyimpannya.
 * Dipanggil di: public/js/lagu-form.js (baris ~60 dalam fungsi handleSave() mode 'add')
 * Alur kerja:
 * 1. Menerima data JSON dari request body (judul, penyanyi, dll)
 * 2. Melakukan validasi (judul wajib diisi)
 * 3. Memasukkan (insert) data tersebut sebagai baris baru ke tabel 'lagu' di Supabase
 */
router.post('/', async (req, res) => {
    const { judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik } = req.body;

    // Validasi sederhana
    if (!judul) {
        return res.status(400).json({ success: false, message: 'Judul lagu wajib diisi!' });
    }

    try {
        const { data, error } = await supabase.from('lagu').insert([
            { judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik }
        ]).select();

        if (error) throw error;
        res.status(201).json({ success: true, message: 'Lagu berhasil ditambahkan', data: data[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 4. PUT: Mengedit lagu
 * Fungsi ini memperbarui data lagu yang sudah ada di database.
 * Dipanggil di: public/js/lagu-form.js (baris ~60 dalam fungsi handleSave() mode 'edit')
 * Alur kerja: Mengambil 'id' dari parameter URL, dan data terbaru dari request body, kemudian mengupdate baris yang sesuai di database.
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik } = req.body;

    if (!judul) {
        return res.status(400).json({ success: false, message: 'Judul lagu wajib diisi!' });
    }

    try {
        const { data, error } = await supabase.from('lagu').update({
            judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik
        }).eq('id', id).select();

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Lagu berhasil diperbarui', data: data[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 5. DELETE: Menghapus lagu
 * Fungsi ini menghapus lagu dari database secara permanen.
 * Dipanggil di: public/js/detail-lagu.js (baris ~75 dalam fungsi deleteLagu())
 * Alur kerja: Menangkap 'id' lagu, lalu menghapus baris dengan 'id' tersebut di tabel 'lagu' Supabase.
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('lagu').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ success: true, message: 'Lagu berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;