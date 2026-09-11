const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// 1. GET: Mengambil semua data jadwal pelayanan
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('jadwal_pelayanan') // Pastikan nama tabel di Supabase sesuai
            .select('*')
            .order('tanggal', { ascending: true });

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data jadwal',
            error: error.message
        });
    }
});

// 2. GET: Mengambil detail jadwal berdasarkan ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('jadwal_pelayanan')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: 'Jadwal tidak ditemukan',
            error: error.message
        });
    }
});

// 3. POST: Menambahkan jadwal pelayanan baru
router.post('/', async (req, res) => {
    const { tanggal, judul, tujuan, pengkotbah } = req.body;

    // Validasi sederhana
    if (!tanggal || !judul || !pengkotbah) {
        return res.status(400).json({
            success: false,
            message: 'Tanggal, judul, dan pengkotbah wajib diisi!'
        });
    }

    try {
        const { data, error } = await supabase
            .from('jadwal_pelayanan')
            .insert([{ tanggal, judul, tujuan, pengkotbah }])
            .select();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Jadwal berhasil ditambahkan',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal menambahkan jadwal',
            error: error.message
        });
    }
});

// 4. PUT: Mengedit / memperbarui data jadwal
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { tanggal, judul, tujuan, pengkotbah } = req.body;

    try {
        const { data, error } = await supabase
            .from('jadwal_pelayanan')
            .update({ tanggal, judul, tujuan, pengkotbah })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Jadwal berhasil diperbarui',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui jadwal',
            error: error.message
        });
    }
});

// 5. DELETE: Menghapus jadwal pelayanan
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('jadwal_pelayanan')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Jadwal berhasil dihapus'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus jadwal',
            error: error.message
        });
    }
});

module.exports = router;