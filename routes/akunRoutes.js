const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

/**
 * 1. GET: Ambil semua data akun
 * Fungsi: Mengambil seluruh daftar pengguna (akun) dari tabel 'pengguna' di database.
 * Dipanggil di: public/js/manajemen-akun.js (fungsi fetchAccounts() baris ~16)
 * Alur kerja: Melakukan query ke Supabase untuk tabel 'pengguna', diurutkan berdasarkan 'nama_lengkap'.
 */
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

/**
 * 2. POST: Tambah akun baru
 * Fungsi: Menambahkan pengguna baru ke tabel 'pengguna'.
 * Dipanggil di: public/js/manajemen-akun.js (fungsi submitAccountForm() baris ~68 saat mode 'add')
 * Alur kerja: Menerima nama_lengkap, email_gmail, dan role dari req.body.
 * Catatan: Jika database memiliki relasi ke tabel auth.users bawaan Supabase, maka 
 * menambahkan email yang belum pernah login bisa menyebabkan error (Foreign Key Constraint).
 */
router.post('/', async (req, res) => {
    const { nama_lengkap, email, role } = req.body;
    try {
        // PERHATIAN: Jika ada relasi FK id_pengguna ke auth.users, query ini bisa gagal 
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

/**
 * 3. PUT: Ubah data akun berdasarkan email
 * Fungsi: Memperbarui data akun (nama_lengkap atau role) berdasarkan alamat email.
 * Dipanggil di: public/js/manajemen-akun.js (fungsi submitAccountForm() baris ~68 saat mode 'edit')
 * Alur kerja: Mencari data di tabel 'pengguna' dengan email tersebut dan mengupdate field yang diberikan.
 */
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

/**
 * 4. DELETE: Hapus akun berdasarkan email
 * Fungsi: Menghapus data akun secara permanen.
 * Dipanggil di: public/js/manajemen-akun.js (fungsi deleteAccount() baris ~110)
 * Alur kerja: Melakukan query delete pada tabel 'pengguna' di mana email_gmail sama dengan parameter.
 */
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

/**
 * 5. POST: Endpoint Login Backend
 * Fungsi: Menerima email dari frontend untuk dicek ke tabel pengguna.
 * Alur kerja: Mengambil 1 baris berdasarkan email dari req.body.
 */
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
