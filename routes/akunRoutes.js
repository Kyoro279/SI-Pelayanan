const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET: Ambil semua data akun
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

// POST: Tambah akun baru
router.post('/', async (req, res) => {
    const { nama_lengkap, email_gmail, role } = req.body;
    try {
        // PERHATIAN: Jika ada relasi FK id_pengguna ke auth.users, query ini bisa gagal 
        // jika email belum terdaftar di sistem Auth Supabase.
        const { data, error } = await supabase
            .from('pengguna')
            .insert([{ 
                nama_lengkap, 
                email_gmail, 
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

// PUT: Ubah data akun berdasarkan email
router.put('/:email', async (req, res) => {
    const oldEmail = req.params.email;
    const { role, nama_lengkap, email_gmail } = req.body;
    try {
        const updateData = {};
        if (role !== undefined) updateData.role = role;
        if (nama_lengkap !== undefined) updateData.nama_lengkap = nama_lengkap;
        if (email_gmail !== undefined) updateData.email_gmail = email_gmail;

        const { data, error } = await supabase
            .from('pengguna')
            .update(updateData)
            .eq('email_gmail', oldEmail)
            .select();

        if (error) throw error;
        res.json({ message: 'Data akun berhasil diperbarui', data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Hapus akun berdasarkan email
router.delete('/:email', async (req, res) => {
    const email = req.params.email;
    try {
        const { data, error } = await supabase
            .from('pengguna')
            .delete()
            .eq('email_gmail', email);

        if (error) throw error;
        res.json({ message: 'Akun berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
