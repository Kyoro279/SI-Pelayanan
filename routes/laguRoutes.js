// routes/laguRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// 1. GET: Mengambil seluruh daftar lagu
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('lagu').select('*').order('judul', { ascending: true });
        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. GET: Mengambil detail lagu berdasarkan ID
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

// 3. POST: Menambahkan lagu baru
router.post('/', async (req, res) => {
    const { judul, penyanyi, kategori, nada_dasar, link_youtube, chord_lirik } = req.body;

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

// 4. PUT: Mengedit lagu
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

// 5. DELETE: Menghapus lagu
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