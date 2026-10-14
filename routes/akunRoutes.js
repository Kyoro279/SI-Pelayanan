const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// get, mengambil semua data pengguna dari tabel pengguna di supabase dan mengurutkannya berdasarkan nama lengkap
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengguna')
            .select('*')
            .order('nama_lengkap', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST menambahkan pengguna baru ke dalam tabel pengguna berupa NamaLengkap , Email, Role 
router.post('/', async (req, res) => {
    const { nama_lengkap, email, role } = req.body;
    try {
        // Jika ada relasi FK id_pengguna ke auth.users, query ini bisa gagal 
        // jika email belum terdaftar di sistem Auth Supabase.
        const { data, error } = await supabase
            .from('pengguna')
            .insert([{
                nama_lengkap,
                email,
                role,
                status_aktif: true
            }])
            .select();

        if (error) throw error;
        res.json({ message: 'Akun berhasil ditambahkan', data });
    } catch (err) {
        // Jika error karena Foreign Key (User belum login Google sama sekali)
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Gagal: Email ini belum pernah login (tidak ada di Auth).' });
        }
        res.status(500).json({ error: err.message });
    }
});

//PUT untuk mengubah / memperbaharui data pengguna berdasarkan email 
router.put('/:email', async (req, res) => {
    const oldEmail = req.params.email;
    const { role, nama_lengkap, email } = req.body;
    try {
        const updateData = {};
        if (role !== undefined) updateData.role = role;
        if (nama_lengkap !== undefined) updateData.nama_lengkap = nama_lengkap;
        if (email !== undefined) updateData.email = email;

        const { data, error } = await supabase
            .from('pengguna')
            .update(updateData)
            .eq('email', oldEmail)
            .select();

        if (error) throw error;
        res.json({ message: 'Data akun berhasil diperbarui', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE untuk menghapus data pengguna berdasarkan email
router.delete('/:email', async (req, res) => {
    const email = req.params.email;
    try {
        const { data, error } = await supabase
            .from('pengguna')
            .delete()
            .eq('email', email);

        if (error) throw error;
        res.json({ message: 'Akun berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// menerima email dari front end halaman login untuk dicek apakah ada di database dan aktif
router.post('/login', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email diperlukan." });
        }

        const { data, error } = await supabase
            .from('pengguna')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: "Akses ditolak: Akun Anda belum didaftarkan oleh Admin ke dalam sistem." });
        }

        if (data.status_aktif === false) {
            return res.status(403).json({ error: "Akses ditolak: Akun Anda sedang dinonaktifkan." });
        }

        res.status(200).json({
            id_pengguna: data.id_pengguna,
            nama_lengkap: data.nama_lengkap,
            role: data.role
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
