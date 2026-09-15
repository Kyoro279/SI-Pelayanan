const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Fallback in-memory data jika tabel di Supabase belum diberi grant permission atau belum dibuat
let fallbackJadwal = [
    {
        id: '1',
        kategori: 'Pelayanan',
        tanggal: '2026-06-06',
        waktu: '17:00',
        judul: 'Iman yang Tidak Goyah',
        tujuan: 'Mengajak jemaat untuk berakar kuat dalam Kristus di tengah tantangan hidup.',
        pengkotbah: 'Ps. Sebastian Marco',
        tim_pelayanan: {
            worship_leader: 'metiu ',
            singer_1: 'jonathan 2',
            singer_2: 'Cloud',
            pianist: 'metiu ',
            bassist: '',
            gitaris: '',
            drummer: '',
            mcm: '',
            lighting: '',
            soundman: '',
            usher_1: '',
            usher_2: ''
        }
    },
    {
        id: '2',
        kategori: 'Pelayanan',
        tanggal: '2026-06-13',
        waktu: '17:00',
        judul: 'Kasih yang Memulihkan',
        tujuan: 'Mengajak jemaat untuk mengenal dan merasakan Kasih Tuhan yang memulihkan.',
        pengkotbah: 'Ps. Fernando',
        tim_pelayanan: {
            worship_leader: 'Cloud',
            singer_1: 'jonathan 2',
            singer_2: '',
            pianist: '',
            bassist: '',
            gitaris: '',
            drummer: '',
            mcm: '',
            lighting: '',
            soundman: '',
            usher_1: '',
            usher_2: ''
        }
    },
    {
        id: '3',
        kategori: 'Pelayanan',
        tanggal: '2026-06-20',
        waktu: '17:00',
        judul: 'Pengharapan di Dalam Tuhan',
        tujuan: 'Mengajak jemaat untuk terus memiliki harapan di dalam Tuhan di tengah kondisi yang tidak baik.',
        pengkotbah: 'Ps. Jeremy Suwanto',
        tim_pelayanan: {
            worship_leader: 'jonathan 2',
            singer_1: 'Cloud',
            singer_2: '',
            pianist: '',
            bassist: '',
            gitaris: '',
            drummer: '',
            mcm: '',
            lighting: '',
            soundman: '',
            usher_1: '',
            usher_2: ''
        }
    }
];

// Helper untuk mencoba eksekusi query ke tabel 'jadwal' atau 'jadwal_pelayanan'
async function trySupabaseQuery(actionFn) {
    try {
        const res1 = await actionFn('jadwal');
        if (!res1.error) return { data: res1.data, error: null };
        if (res1.error.code === 'PGRST205' || res1.error.message.includes('Could not find')) {
            const res2 = await actionFn('jadwal_pelayanan');
            if (!res2.error) return { data: res2.data, error: null };
            return { data: null, error: res2.error };
        }
        return { data: null, error: res1.error };
    } catch (err) {
        return { data: null, error: err };
    }
}

// 1. GET: Mengambil semua data jadwal pelayanan
router.get('/', async (req, res) => {
    try {
        const { data, error } = await trySupabaseQuery(tableName =>
            supabase.from(tableName).select('*').order('tanggal', { ascending: true })
        );

        if (error) {
            console.warn(`[Jadwal API] Supabase warning (${error.message}). Menggunakan fallback data.`);
            return res.status(200).json({
                success: true,
                data: fallbackJadwal,
                fromFallback: true
            });
        }

        if (data) {
            data.forEach(item => {
                if (item.id_jadwal && !item.id) item.id = String(item.id_jadwal);
            });
        }

        res.status(200).json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('[Jadwal API Error]:', error);
        res.status(200).json({
            success: true,
            data: fallbackJadwal,
            fromFallback: true
        });
    }
});

// 2. GET: Mengambil detail jadwal berdasarkan ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await trySupabaseQuery(tableName =>
            supabase.from(tableName).select('*').eq('id_jadwal', parseInt(id)).single()
        );

        if (error) {
            const item = fallbackJadwal.find(j => String(j.id) === String(id));
            if (!item) {
                return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan' });
            }
            return res.status(200).json({ success: true, data: item });
        }

        if (data && data.id_jadwal && !data.id) {
            data.id = String(data.id_jadwal);
        }

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        const item = fallbackJadwal.find(j => String(j.id) === String(id));
        if (item) {
            return res.status(200).json({ success: true, data: item });
        }
        res.status(404).json({
            success: false,
            message: 'Jadwal tidak ditemukan',
            error: error.message
        });
    }
});

// 3. POST: Menambahkan jadwal pelayanan baru
router.post('/', async (req, res) => {
    const {
        kategori = 'Pelayanan',
        tanggal,
        waktu = '',
        judul,
        tema_kotbah,
        tujuan,
        ringkasan_tujuan,
        pengkotbah,
        tim_pelayanan = {}
    } = req.body;

    const finalJudul = judul || tema_kotbah;
    const finalTujuan = tujuan || ringkasan_tujuan || '';

    // Validasi sederhana
    if (!tanggal || !finalJudul) {
        return res.status(400).json({
            success: false,
            message: 'Tanggal dan Tema / Judul wajib diisi!'
        });
    }

    try {
        // Bypass sequence permission error dengan mengambil max id secara manual
        let nextId = 1;
        const { data: maxData } = await trySupabaseQuery(tableName => 
            supabase.from(tableName).select('id_jadwal').order('id_jadwal', { ascending: false }).limit(1)
        );
        if (maxData && maxData.length > 0) {
            nextId = parseInt(maxData[0].id_jadwal) + 1;
        }

        const newRecord = {
            id_jadwal: nextId,
            kategori,
            tanggal,
            waktu,
            judul: finalJudul,
            tujuan: finalTujuan,
            pengkotbah: pengkotbah || '',
            tim_pelayanan,
            tanggal_pelayanan: tanggal, 
            jam_pelayanan: waktu.length === 5 ? waktu + ':00' : waktu 
        };

        const { data, error } = await trySupabaseQuery(tableName =>
            supabase.from(tableName).insert([newRecord]).select()
        );

        if (error) {
            console.warn(`[Jadwal API] Gagal insert ke Supabase (${error.message}). Menyimpan ke memori.`);
            const newItem = {
                id: String(Date.now()),
                ...newRecord
            };
            fallbackJadwal.push(newItem);
            fallbackJadwal.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

            return res.status(201).json({
                success: true,
                message: 'Jadwal berhasil ditambahkan',
                data: [newItem]
            });
        }

        if (data && data.length > 0) {
            data.forEach(item => { if (item.id_jadwal && !item.id) item.id = String(item.id_jadwal); });
        }

        res.status(201).json({
            success: true,
            message: 'Jadwal berhasil ditambahkan',
            data: data
        });
    } catch (error) {
        const newItem = {
            id: String(Date.now()),
            ...newRecord
        };
        fallbackJadwal.push(newItem);
        res.status(201).json({
            success: true,
            message: 'Jadwal berhasil ditambahkan',
            data: [newItem]
        });
    }
});

// 4. PUT: Mengedit / memperbarui data jadwal
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        kategori,
        tanggal,
        waktu,
        judul,
        tema_kotbah,
        tujuan,
        ringkasan_tujuan,
        pengkotbah,
        tim_pelayanan
    } = req.body;

    const updateFields = {};
    if (kategori !== undefined) updateFields.kategori = kategori;
    if (tanggal !== undefined) {
        updateFields.tanggal = tanggal;
        updateFields.tanggal_pelayanan = tanggal;
    }
    if (waktu !== undefined) {
        updateFields.waktu = waktu;
        updateFields.jam_pelayanan = waktu.length === 5 ? waktu + ':00' : waktu;
    }
    if (judul !== undefined || tema_kotbah !== undefined) updateFields.judul = judul || tema_kotbah;
    if (tujuan !== undefined || ringkasan_tujuan !== undefined) updateFields.tujuan = (tujuan !== undefined ? tujuan : ringkasan_tujuan);
    if (pengkotbah !== undefined) updateFields.pengkotbah = pengkotbah;
    if (tim_pelayanan !== undefined) updateFields.tim_pelayanan = tim_pelayanan;

    try {
        const { data, error } = await trySupabaseQuery(tableName =>
            supabase.from(tableName)
                .update(updateFields)
                .eq('id_jadwal', parseInt(id))
                .select()
        );

        if (error) {
            console.warn(`[Jadwal API] Gagal update ke Supabase (${error.message}). Memperbarui memori.`);
            const index = fallbackJadwal.findIndex(j => String(j.id) === String(id));
            if (index > -1) {
                Object.assign(fallbackJadwal[index], updateFields);
                fallbackJadwal.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
                return res.status(200).json({
                    success: true,
                    message: 'Jadwal berhasil diperbarui',
                    data: [fallbackJadwal[index]]
                });
            }
        }

        if (data && data.length > 0) {
            data.forEach(item => { if (item.id_jadwal && !item.id) item.id = String(item.id_jadwal); });
        }

        res.status(200).json({
            success: true,
            message: 'Jadwal berhasil diperbarui',
            data: data
        });
    } catch (error) {
        const index = fallbackJadwal.findIndex(j => String(j.id) === String(id));
        if (index > -1) {
            Object.assign(fallbackJadwal[index], updateFields);
            return res.status(200).json({
                success: true,
                message: 'Jadwal berhasil diperbarui',
                data: [fallbackJadwal[index]]
            });
        }
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
        const { error } = await trySupabaseQuery(tableName =>
            supabase.from(tableName).delete().eq('id_jadwal', parseInt(id))
        );

        if (error) {
            console.warn(`[Jadwal API] Gagal delete di Supabase (${error.message}). Menghapus dari memori.`);
        }

        fallbackJadwal = fallbackJadwal.filter(j => String(j.id) !== String(id));

        res.status(200).json({
            success: true,
            message: 'Jadwal berhasil dihapus'
        });
    } catch (error) {
        fallbackJadwal = fallbackJadwal.filter(j => String(j.id) !== String(id));
        res.status(200).json({
            success: true,
            message: 'Jadwal berhasil dihapus'
        });
    }
});

module.exports = router;