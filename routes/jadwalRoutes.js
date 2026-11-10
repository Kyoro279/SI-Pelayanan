// routes/jadwalRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Mapping nama peran internal ke label peran yang seragam
const ROLE_LABELS = {
    worship_leader: 'Worship Leader',
    singer_1: 'Singer 1',
    singer_2: 'Singer 2',
    pianist: 'Pianist',
    bassist: 'Bassist',
    gitaris: 'Gitaris',
    drummer: 'Drummer',
    mcm: 'MCM',
    lighting: 'Lighting',
    soundman: 'Soundman',
    usher: 'Usher'
};

// Normalisasi string peran ke key peran standar (contoh: "Worship Leader" -> "worship_leader")
function normalizeRoleKey(peran) {
    if (!peran) return '';
    const clean = peran.toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (clean === 'wl') return 'worship_leader';
    if (clean === 'singer1' || clean === 'singer_1') return 'singer_1';
    if (clean === 'singer2' || clean === 'singer_2') return 'singer_2';
    if (clean === 'pianis' || clean === 'pianist') return 'pianist';
    if (clean === 'usher' || clean === 'usher1' || clean === 'usher_1' || clean === 'usher2' || clean === 'usher_2') return 'usher';
    return clean;
}

// Helper: Menyeragamkan format objek jadwal (kolom database baru + alias untuk frontend)
function formatScheduleOutput(record, tim_pelayanan = {}, tim_pelayanan_id = {}, petugas = [], daftar_lagu = []) {
    const rawTime = record.jam_pelayanan || record.waktu || '17:00';
    const cleanTime = rawTime.length >= 5 ? rawTime.substring(0, 5) : rawTime;
    const cleanDate = record.tanggal_pelayanan || record.tanggal || '';
    const cleanTema = record.tema_kotbah || record.judul || '';
    const cleanTujuan = record.tujuan_ringkasan || record.tujuan || '';

    return {
        // Kolom Database Baru (Sesuai Skema Supabase)
        id_jadwal: record.id_jadwal,
        tanggal_pelayanan: cleanDate,
        jam_pelayanan: rawTime,
        tema_kotbah: cleanTema,
        tujuan_ringkasan: cleanTujuan,
        pengkotbah: record.pengkotbah || '',
        status_jadwal: record.status_jadwal !== undefined ? record.status_jadwal : true,
        kategori: record.kategori || 'Pelayanan',
        created_at: record.created_at,

        // Relasi Penugasan & Lagu
        tim_pelayanan: tim_pelayanan || {},
        tim_pelayanan_id: tim_pelayanan_id || {},
        petugas: petugas || [],
        daftar_lagu: daftar_lagu || [],

        // Alias Kompatibilitas Frontend & Modul Terkait
        id: String(record.id_jadwal),
        tanggal: cleanDate,
        waktu: cleanTime,
        judul: cleanTema,
        tujuan: cleanTujuan
    };
}
//==============BAGIAN AMBIL DATA PELAYAN KE JADWAL===============

// mengambil jadwal lengkap beserta relasi jadwal_tugas dan jadwal_lagu dari Supabase
async function fetchSchedulesFromDb(singleId = null) {
    // 1. Ambil data baris jadwal dari tabel 'jadwal'
    let jadwalQuery = supabase.from('jadwal').select('*');
    if (singleId) {
        jadwalQuery = jadwalQuery.eq('id_jadwal', parseInt(singleId));
    } else {
        jadwalQuery = jadwalQuery.order('tanggal_pelayanan', { ascending: true });
    }

    const { data: jadwalRows, error: jErr } = await jadwalQuery;
    if (jErr) throw jErr;
    if (!jadwalRows || jadwalRows.length === 0) return singleId ? null : [];

    // 2. Ambil master data pengguna untuk mencocokkan id_pengguna -> nama_lengkap
    const { data: usersRows } = await supabase.from('pengguna').select('*');
    const userMap = new Map();
    (usersRows || []).forEach(u => userMap.set(u.id_pengguna, u));

    // 3. Ambil data tim penugasan (jadwal_tugas)
    const scheduleIds = jadwalRows.map(j => j.id_jadwal);
    let tugasRows = [];
    try {
        const { data: tugasData, error: tErr } = await supabase
            .from('jadwal_tugas')
            .select('*')
            .in('id_jadwal', scheduleIds);
        if (!tErr && tugasData) tugasRows = tugasData;
    } catch (e) {
        console.warn('[Jadwal API] Warning fetch jadwal_tugas:', e.message);
    }

    // 4. Ambil data lagu per jadwal (jadwal_lagu)
    let jadwalLaguRows = [];
    let songMap = new Map();
    try {
        const { data: jlData, error: jlErr } = await supabase
            .from('jadwal_lagu')
            .select('*')
            .in('id_jadwal', scheduleIds)
            .order('urutan', { ascending: true });
        if (!jlErr && jlData) {
            jadwalLaguRows = jlData;
            const songIds = jlData.map(item => item.id_lagu).filter(Boolean);
            if (songIds.length > 0) {
                const { data: masterLagu, error: laguErr } = await supabase
                    .from('lagu')
                    .select('*')
                    .in('id_lagu', songIds);
                if (!laguErr && masterLagu) {
                    masterLagu.forEach(s => songMap.set(s.id_lagu, s));
                }
            }
        }
    } catch (e) {
        console.warn('[Jadwal API] Warning fetch jadwal_lagu:', e.message);
    }

    // 5. Gabungkan menjadi objek jadwal lengkap
    const mappedList = jadwalRows.map(j => {
        const scheduleTasks = tugasRows.filter(t => t.id_jadwal === j.id_jadwal);
        const tim_pelayanan = {};
        const tim_pelayanan_id = {};
        const petugas = [];

        scheduleTasks.forEach(t => {
            const user = userMap.get(t.id_pengguna);
            const roleKey = normalizeRoleKey(t.peran);
            const userName = user ? user.nama_lengkap : '';
            tim_pelayanan[roleKey] = userName;
            tim_pelayanan_id[roleKey] = t.id_pengguna;
            petugas.push({
                id_pengguna: t.id_pengguna,
                nama_lengkap: userName,
                peran: t.peran,
                role_key: roleKey
            });
        });

        const scheduleSongs = jadwalLaguRows
            .filter(jl => jl.id_jadwal === j.id_jadwal)
            .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
            .map((jl, idx) => {
                const song = songMap.get(jl.id_lagu) || {};
                return {
                    id_lagu: jl.id_lagu,
                    id: jl.id_lagu,
                    urutan: jl.urutan || (idx + 1),
                    judul: song.judul_lagu || '',
                    judul_lagu: song.judul_lagu || '',
                    pengarang: song.pengarang || '',
                    penyanyi: song.pengarang || '',
                    kategori: song.kategori || '',
                    nada_dasar: song.nada_dasar || '',
                    link_youtube: song.link_youtube || '',
                    chord_lirik: song.chord_lirik || ''
                };
            });

        return formatScheduleOutput(j, tim_pelayanan, tim_pelayanan_id, petugas, scheduleSongs);
    });

    return singleId ? mappedList[0] || null : mappedList;
}

/**
 * 1. GET: Mengambil semua data jadwal pelayanan murni dari database
 * Endpoint: /api/jadwal
 */
router.get('/', async (req, res) => {
    try {
        const schedules = await fetchSchedulesFromDb();
        return res.status(200).json({
            success: true,
            data: schedules || []
        });
    } catch (error) {
        console.error(`[Jadwal API Error] Gagal mengambil jadwal dari Supabase:`, error.message);
        // Jika ada masalah atau tabel belum terisi, kembalikan array kosong (tidak menggunakan dummy data)
        return res.status(200).json({
            success: true,
            data: [],
            error: error.message
        });
    }
});

/**
 * 2. GET: Mengambil detail jadwal berdasarkan ID
 * Endpoint: /api/jadwal/:id
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const item = await fetchSchedulesFromDb(id);
        if (item) {
            return res.status(200).json({ success: true, data: item });
        }
        return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan' });
    } catch (error) {
        console.error(`[Jadwal API Error] Detail jadwal ID ${id} gagal:`, error.message);
        return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan', error: error.message });
    }
});

/**
 * 3. POST: Menambahkan jadwal pelayanan baru ke database
 * Endpoint: /api/jadwal
 */
router.post('/', async (req, res) => {
    const {
        kategori = 'Pelayanan',
        tanggal,
        tanggal_pelayanan,
        waktu = '17:00',
        jam_pelayanan,
        judul,
        tema_kotbah,
        tujuan,
        tujuan_ringkasan,
        ringkasan_tujuan,
        pengkotbah,
        status_jadwal = true,
        tim_pelayanan = {},
        daftar_lagu = []
    } = req.body;

    const finalTanggal = tanggal_pelayanan || tanggal;
    const finalJudul = tema_kotbah || judul;
    const finalTujuan = tujuan_ringkasan || ringkasan_tujuan || tujuan || '';
    let finalWaktu = jam_pelayanan || waktu || '17:00';
    if (finalWaktu.length === 5) finalWaktu += ':00';

    if (!finalTanggal || !finalJudul) {
        return res.status(400).json({
            success: false,
            message: 'Tanggal dan Tema / Judul wajib diisi!'
        });
    }

    try {
        // Ambil ID tertinggi saat ini untuk ID sequence jika diperlukan
        let nextId = 1;
        const { data: maxRows } = await supabase
            .from('jadwal')
            .select('id_jadwal')
            .order('id_jadwal', { ascending: false })
            .limit(1);

        if (maxRows && maxRows.length > 0 && maxRows[0].id_jadwal) {
            nextId = parseInt(maxRows[0].id_jadwal) + 1;
        }

        const newJadwalRecord = {
            id_jadwal: nextId,
            tanggal_pelayanan: finalTanggal,
            jam_pelayanan: finalWaktu,
            tema_kotbah: finalJudul,
            tujuan_ringkasan: finalTujuan,
            pengkotbah: (kategori === 'Latihan' || kategori === 'Event') ? '' : (pengkotbah || ''),
            status_jadwal: status_jadwal !== undefined ? status_jadwal : true,
            kategori: kategori || 'Pelayanan'
        };

        // Insert ke tabel jadwal
        let insertRes = await supabase.from('jadwal').insert([newJadwalRecord]).select();

        // Jika error karena kolom identity, coba insert tanpa id_jadwal manual
        if (insertRes.error && (insertRes.error.message.includes('identity') || insertRes.error.message.includes('GENERATED ALWAYS'))) {
            const { id_jadwal, ...withoutId } = newJadwalRecord;
            insertRes = await supabase.from('jadwal').insert([withoutId]).select();
        }

        if (insertRes.error) {
            throw insertRes.error;
        }

        const createdItem = insertRes.data && insertRes.data[0] ? insertRes.data[0] : newJadwalRecord;
        const createdId = createdItem.id_jadwal || nextId;

        // Ambil daftar pengguna untuk pemetaan peran -> id_pengguna
        const { data: usersRows } = await supabase.from('pengguna').select('*');
        const tugasToInsert = [];

        if (tim_pelayanan && typeof tim_pelayanan === 'object') {
            for (const [roleKey, userVal] of Object.entries(tim_pelayanan)) {
                if (!userVal) continue;
                let userId = null;
                if (typeof userVal === 'number' || /^\d+$/.test(String(userVal).trim())) {
                    userId = parseInt(userVal);
                } else {
                    const found = (usersRows || []).find(
                        u => u.nama_lengkap.trim().toLowerCase() === String(userVal).trim().toLowerCase()
                    );
                    if (found) userId = found.id_pengguna;
                }

                if (userId) {
                    tugasToInsert.push({
                        id_jadwal: createdId,
                        id_pengguna: userId,
                        peran: ROLE_LABELS[roleKey] || roleKey
                    });
                }
            }
        }

        if (tugasToInsert.length > 0) {
            const { error: tugasErr } = await supabase.from('jadwal_tugas').insert(tugasToInsert);
            if (tugasErr) console.warn('[Jadwal API] Warning insert jadwal_tugas:', tugasErr.message);
        }

        // Insert daftar lagu jika ada
        if (Array.isArray(daftar_lagu) && daftar_lagu.length > 0) {
            const songsToInsert = daftar_lagu.map((item, idx) => ({
                id_jadwal: createdId,
                id_lagu: item.id_lagu || item.id,
                urutan: item.urutan || (idx + 1)
            })).filter(s => s.id_lagu);

            if (songsToInsert.length > 0) {
                await supabase.from('jadwal_lagu').insert(songsToInsert);
            }
        }

        const fullSchedule = await fetchSchedulesFromDb(createdId);
        return res.status(201).json({
            success: true,
            message: 'Jadwal berhasil ditambahkan',
            data: fullSchedule ? [fullSchedule] : [formatScheduleOutput(createdItem, tim_pelayanan)]
        });

    } catch (error) {
        console.error(`[Jadwal API Error] Gagal menambahkan jadwal ke Supabase:`, error.message);
        return res.status(500).json({
            success: false,
            message: 'Gagal menambahkan jadwal: ' + error.message,
            error: error.message
        });
    }
});

/**
 * 4. PUT: Mengedit / memperbarui data jadwal di database
 * Endpoint: /api/jadwal/:id
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        kategori,
        tanggal,
        tanggal_pelayanan,
        waktu,
        jam_pelayanan,
        judul,
        tema_kotbah,
        tujuan,
        tujuan_ringkasan,
        ringkasan_tujuan,
        pengkotbah,
        status_jadwal,
        tim_pelayanan,
        daftar_lagu
    } = req.body;

    const updateFields = {};
    if (kategori !== undefined) updateFields.kategori = kategori;
    if (tanggal_pelayanan !== undefined || tanggal !== undefined) {
        updateFields.tanggal_pelayanan = tanggal_pelayanan !== undefined ? tanggal_pelayanan : tanggal;
    }
    if (jam_pelayanan !== undefined || waktu !== undefined) {
        let rawTime = jam_pelayanan !== undefined ? jam_pelayanan : waktu;
        if (rawTime.length === 5) rawTime += ':00';
        updateFields.jam_pelayanan = rawTime;
    }
    if (tema_kotbah !== undefined || judul !== undefined) {
        updateFields.tema_kotbah = tema_kotbah !== undefined ? tema_kotbah : judul;
    }
    if (tujuan_ringkasan !== undefined || ringkasan_tujuan !== undefined || tujuan !== undefined) {
        updateFields.tujuan_ringkasan = tujuan_ringkasan !== undefined ? tujuan_ringkasan : (ringkasan_tujuan !== undefined ? ringkasan_tujuan : tujuan);
    }
    if (pengkotbah !== undefined) updateFields.pengkotbah = pengkotbah;
    if (status_jadwal !== undefined) updateFields.status_jadwal = status_jadwal;

    try {
        const intId = parseInt(id);

        // Update baris utama tabel jadwal
        if (Object.keys(updateFields).length > 0) {
            const { error: updErr } = await supabase
                .from('jadwal')
                .update(updateFields)
                .eq('id_jadwal', intId);
            if (updErr) throw updErr;
        }

        // Update relasi tim penugasan jika dikirimkan
        if (tim_pelayanan !== undefined && typeof tim_pelayanan === 'object') {
            await supabase.from('jadwal_tugas').delete().eq('id_jadwal', intId);

            const { data: usersRows } = await supabase.from('pengguna').select('*');
            const tugasToInsert = [];

            for (const [roleKey, userVal] of Object.entries(tim_pelayanan)) {
                if (!userVal) continue;
                let userId = null;
                if (typeof userVal === 'number' || /^\d+$/.test(String(userVal).trim())) {
                    userId = parseInt(userVal);
                } else {
                    const found = (usersRows || []).find(
                        u => u.nama_lengkap.trim().toLowerCase() === String(userVal).trim().toLowerCase()
                    );
                    if (found) userId = found.id_pengguna;
                }

                if (userId) {
                    tugasToInsert.push({
                        id_jadwal: intId,
                        id_pengguna: userId,
                        peran: ROLE_LABELS[roleKey] || roleKey
                    });
                }
            }

            if (tugasToInsert.length > 0) {
                await supabase.from('jadwal_tugas').insert(tugasToInsert);
            }
        }

        // Update setlist lagu jika dikirimkan
        if (daftar_lagu !== undefined && Array.isArray(daftar_lagu)) {
            await supabase.from('jadwal_lagu').delete().eq('id_jadwal', intId);

            const songsToInsert = daftar_lagu.map((item, idx) => ({
                id_jadwal: intId,
                id_lagu: item.id_lagu || item.id,
                urutan: item.urutan || (idx + 1)
            })).filter(s => s.id_lagu);

            if (songsToInsert.length > 0) {
                await supabase.from('jadwal_lagu').insert(songsToInsert);
            }
        }

        const updatedSchedule = await fetchSchedulesFromDb(intId);
        return res.status(200).json({
            success: true,
            message: 'Jadwal berhasil diperbarui',
            data: updatedSchedule ? [updatedSchedule] : []
        });

    } catch (error) {
        console.error(`[Jadwal API Error] Gagal memperbarui jadwal di Supabase:`, error.message);
        return res.status(500).json({
            success: false,
            message: 'Gagal memperbarui jadwal: ' + error.message,
            error: error.message
        });
    }
});

/**
 * 5. DELETE: Menghapus jadwal pelayanan dari database
 * Endpoint: /api/jadwal/:id
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const intId = parseInt(id);

    try {
        // Hapus data relasi terkait terlebih dahulu
        await supabase.from('jadwal_tugas').delete().eq('id_jadwal', intId);
        await supabase.from('jadwal_lagu').delete().eq('id_jadwal', intId);
        try {
            await supabase.from('chat_berhalangan').delete().eq('id_jadwal', intId);
        } catch (_) { }

        // Hapus baris jadwal utama
        const { error: delErr } = await supabase.from('jadwal').delete().eq('id_jadwal', intId);
        if (delErr) throw delErr;

        return res.status(200).json({
            success: true,
            message: 'Jadwal berhasil dihapus'
        });
    } catch (error) {
        console.error(`[Jadwal API Error] Gagal menghapus jadwal:`, error.message);
        return res.status(500).json({
            success: false,
            message: 'Gagal menghapus jadwal: ' + error.message,
            error: error.message
        });
    }
});

module.exports = router;