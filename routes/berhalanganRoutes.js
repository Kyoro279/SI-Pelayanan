// routes/berhalanganRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Fallback in-memory data jika tabel berhalangan belum ada di Supabase
let fallbackBerhalangan = [];

// Helper: Cek apakah tabel 'berhalangan' ada di Supabase
async function isTableAvailable() {
    try {
        const { error } = await supabase.from('berhalangan').select('id').limit(1);
        if (error && (error.code === '42P01' || error.message.includes('schema cache') || error.message.includes('not find'))) {
            return false;
        }
        return !error;
    } catch {
        return false;
    }
}

// 1. GET: Ambil daftar permintaan berhalangan
router.get('/', async (req, res) => {
    const { status } = req.query; // 'Belum Diproses' | 'all' | dll.
    try {
        const tableExists = await isTableAvailable();
        
        // Auto-cleanup: hapus data yang sudah diproses dan lebih dari 2 minggu
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        if (tableExists) {
            // Hapus di background (non-blocking)
            supabase.from('berhalangan')
                .delete()
                .neq('status', 'Belum Diproses')
                .lt('updated_at', twoWeeksAgo.toISOString())
                .then(({ error }) => {
                    if (error) console.error('Error cleaning up old berhalangan:', error);
                });

            let query = supabase.from('berhalangan').select('*').order('created_at', { ascending: false });
            if (status && status !== 'all' && status !== 'Semua') {
                query = query.eq('status', status);
            }
            const { data, error } = await query;
            if (error) throw error;
            return res.json({ success: true, data });
        } else {
            // Cleanup fallback data
            fallbackBerhalangan = fallbackBerhalangan.filter(item => {
                if (item.status !== 'Belum Diproses') {
                    const dateToCheck = new Date(item.updated_at || item.created_at);
                    if (dateToCheck < twoWeeksAgo) return false; // Hapus
                }
                return true; // Simpan
            });

            // Gunakan fallback in-memory data
            let result = [...fallbackBerhalangan];
            if (status && status !== 'all' && status !== 'Semua') {
                result = result.filter(item => item.status.toLowerCase() === status.toLowerCase());
            }
            return res.json({ success: true, data: result });
        }
    } catch (err) {
        console.error('Error GET /api/berhalangan:', err);
        let result = [...fallbackBerhalangan];
        if (status && status !== 'all' && status !== 'Semua') {
            result = result.filter(item => item.status.toLowerCase() === status.toLowerCase());
        }
        res.json({ success: true, data: result });
    }
});

// 2. GET: Detail permintaan berdasarkan ID
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const tableExists = await isTableAvailable();
        if (tableExists) {
            const { data, error } = await supabase.from('berhalangan').select('*').eq('id', id).single();
            if (error) throw error;
            return res.json({ success: true, data });
        } else {
            const item = fallbackBerhalangan.find(b => b.id === id);
            if (!item) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
            return res.json({ success: true, data: item });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. POST: Buat permintaan berhalangan baru
router.post('/', async (req, res) => {
    const { nama, catatan, id_jadwal, judul_pelayanan, jadwal_tanggal, alasan } = req.body;

    if (!nama || !alasan) {
        return res.status(400).json({ success: false, message: 'Nama dan Alasan wajib diisi!' });
    }

    const newRecord = {
        nama,
        catatan: catatan || `Catatan ${nama.split(' ')[0]}`,
        id_jadwal: id_jadwal ? parseInt(id_jadwal) : null,
        judul_pelayanan: judul_pelayanan || 'Pelayanan Umum',
        jadwal_tanggal: jadwal_tanggal || new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        alasan,
        status: 'Belum Diproses',
        nama_pengganti: null,
        created_at: new Date().toISOString()
    };

    try {
        const tableExists = await isTableAvailable();
        if (tableExists) {
            const { data, error } = await supabase.from('berhalangan').insert([newRecord]).select();
            if (error) throw error;
            return res.status(201).json({ success: true, message: 'Permintaan berhalangan berhasil dikirim', data: data[0] });
        } else {
            const nextId = fallbackBerhalangan.length > 0 ? Math.max(...fallbackBerhalangan.map(i => i.id || 0)) + 1 : 1;
            const createdItem = { id: nextId, ...newRecord };
            fallbackBerhalangan.unshift(createdItem);
            return res.status(201).json({ success: true, message: 'Permintaan berhalangan berhasil dikirim', data: createdItem });
        }
    } catch (err) {
        console.error('Error POST /api/berhalangan:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. PUT: Tandai Selesai (dengan memilih nama pengganti)
router.put('/:id/selesai', async (req, res) => {
    const id = parseInt(req.params.id);
    const { nama_pengganti } = req.body;

    try {
        const tableExists = await isTableAvailable();
        if (tableExists) {
            const { data, error } = await supabase
                .from('berhalangan')
                .update({
                    status: 'Selesai',
                    nama_pengganti: nama_pengganti || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
            if (error) throw error;
            return res.json({ success: true, message: 'Permintaan berhasil ditandai selesai', data: data[0] });
        } else {
            const index = fallbackBerhalangan.findIndex(b => b.id === id);
            if (index === -1) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

            fallbackBerhalangan[index] = {
                ...fallbackBerhalangan[index],
                status: 'Selesai',
                nama_pengganti: nama_pengganti || null,
                updated_at: new Date().toISOString()
            };
            return res.json({ success: true, message: 'Permintaan berhasil ditandai selesai', data: fallbackBerhalangan[index] });
        }
    } catch (err) {
        console.error('Error PUT /api/berhalangan/:id/selesai:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. PUT: Tolak permintaan
router.put('/:id/tolak', async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        const tableExists = await isTableAvailable();
        if (tableExists) {
            const { data, error } = await supabase
                .from('berhalangan')
                .update({
                    status: 'Ditolak',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
            if (error) throw error;
            return res.json({ success: true, message: 'Permintaan berhalangan ditolak', data: data[0] });
        } else {
            const index = fallbackBerhalangan.findIndex(b => b.id === id);
            if (index === -1) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

            fallbackBerhalangan[index] = {
                ...fallbackBerhalangan[index],
                status: 'Ditolak',
                updated_at: new Date().toISOString()
            };
            return res.json({ success: true, message: 'Permintaan berhalangan ditolak', data: fallbackBerhalangan[index] });
        }
    } catch (err) {
        console.error('Error PUT /api/berhalangan/:id/tolak:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. DELETE: Hapus data permintaan
router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const tableExists = await isTableAvailable();
        if (tableExists) {
            const { error } = await supabase.from('berhalangan').delete().eq('id', id);
            if (error) throw error;
            return res.json({ success: true, message: 'Data berhasil dihapus' });
        } else {
            fallbackBerhalangan = fallbackBerhalangan.filter(b => b.id !== id);
            return res.json({ success: true, message: 'Data berhasil dihapus' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
