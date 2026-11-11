// routes/berhalanganRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatTanggalJadwal(dateStr) {
    if (!dateStr) return '-';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        return `${HARI_INDONESIA[dateObj.getDay()]}, ${day} ${BULAN_INDONESIA[month]} ${year}`;
    }
    return dateStr;
}

function getLocalTimestampStr() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

function normalizeStatusBaca(raw) {
    if (!raw) return 'Belum Dibaca';
    return String(raw).toLowerCase().startsWith('dibaca') ? 'Dibaca' : 'Belum Dibaca';
}

/**
 * Helper: Mengambil dan mengelompokkan data chat_berhalangan menjadi thread per (id_jadwal, id_pengguna)
 * sehingga setiap pesan baru tampil sebagai bubble terpisah (Opsi 1) dengan tetap menggunakan 10 atribut tabel chat_berhalangan.
 */
async function fetchChatsWithRelations(filters = {}) {
    // Jika hanya mencari id_chat tertentu, cari tahu dulu id_jadwal & id_pengguna dari baris tersebut
    let targetJadwalId = filters.id_jadwal ? parseInt(filters.id_jadwal, 10) : null;
    let targetPenggunaId = filters.id_pengguna ? parseInt(filters.id_pengguna, 10) : null;

    if (filters.id_chat && (!targetJadwalId || !targetPenggunaId)) {
        const { data: singleRow } = await supabase
            .from('chat_berhalangan')
            .select('id_jadwal, id_pengguna')
            .eq('id_chat', parseInt(filters.id_chat, 10))
            .single();
        if (singleRow) {
            targetJadwalId = Number(singleRow.id_jadwal);
            targetPenggunaId = Number(singleRow.id_pengguna);
        }
    }

    let query = supabase
        .from('chat_berhalangan')
        .select('*')
        .order('id_chat', { ascending: true });

    if (targetJadwalId) {
        query = query.eq('id_jadwal', targetJadwalId);
    }
    if (targetPenggunaId) {
        query = query.eq('id_pengguna', targetPenggunaId);
    }

    const { data: chatRows, error: chatErr } = await query;
    if (chatErr) throw chatErr;
    if (!chatRows || chatRows.length === 0) return [];

    const [{ data: usersRows }, { data: jadwalRows }] = await Promise.all([
        supabase.from('pengguna').select('*'),
        supabase.from('jadwal').select('*')
    ]);

    const userMap = new Map();
    (usersRows || []).forEach(u => userMap.set(Number(u.id_pengguna), u));

    const jadwalMap = new Map();
    (jadwalRows || []).forEach(j => jadwalMap.set(Number(j.id_jadwal), j));

    // Kelompokkan baris berdasarkan pasangan (id_jadwal, id_pengguna)
    const threadMap = new Map();

    chatRows.forEach(row => {
        const key = `${row.id_jadwal}_${row.id_pengguna}`;
        if (!threadMap.has(key)) {
            threadMap.set(key, []);
        }
        threadMap.get(key).push(row);
    });

    let threads = [];

    for (const [, rows] of threadMap.entries()) {
        // Urutkan baris dalam thread berdasarkan id_chat ASC
        rows.sort((a, b) => Number(a.id_chat) - Number(b.id_chat));

        const firstRow = rows[0];
        const lastRow = rows[rows.length - 1];

        const pengirim = userMap.get(Number(firstRow.id_pengguna));
        const penindaklanjut = userMap.get(Number(lastRow.id_penindaklanjut));
        const jadwal = jadwalMap.get(Number(firstRow.id_jadwal));

        const namaPengirim = pengirim ? (pengirim.nama_lengkap || '').trim() : 'Pelayan';
        const judulPelayanan = jadwal ? (jadwal.tema_kotbah || jadwal.judul || 'Pelayanan') : 'Pelayanan';
        const tanggalRaw = jadwal ? (jadwal.tanggal_pelayanan || jadwal.tanggal || '') : '';
        const jadwalTanggalFormatted = tanggalRaw ? formatTanggalJadwal(tanggalRaw) : '-';

        // Susun daftar gelembung pesan (messages) secara kronologis
        const messages = [];
        rows.forEach(r => {
            const textPelayan = (r.isi_pesan || '').trim();
            // Baris dengan isi_pesan !== '-' dianggap memiliki bubble dari pelayan
            if (textPelayan && textPelayan !== '-') {
                messages.push({
                    id_chat: r.id_chat,
                    sender: 'pelayan',
                    nama: namaPengirim,
                    text: textPelayan,
                    timestamp: r.timestamp_kirim
                });
            }

            const textWp = (r.pesan_balasan || '').trim();
            if (textWp) {
                messages.push({
                    id_chat: r.id_chat,
                    sender: 'wp',
                    nama: 'Worship Planner',
                    text: textWp,
                    timestamp: r.timestamp_balas || r.timestamp_kirim,
                    status_baca: normalizeStatusBaca(r.status_baca)
                });
            }
        });

        // Urutkan messages berdasarkan waktu (jika waktu sama, pertahankan urutan penyisipan)
        messages.sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            if (ta !== tb) return ta - tb;
            return Number(a.id_chat) - Number(b.id_chat);
        });

        // Status penanganan diambil dari baris terbaru (atau jika ada baris Selesai dan baris terbaru juga Selesai)
        const rawStatus = (lastRow.status_penanganan || 'Sedang Proses').trim();
        const isSelesai = rawStatus.toLowerCase() === 'selesai';
        const normalizedStatus = isSelesai ? 'Selesai' : 'Sedang Proses';

        // Cari pesan pelayan terakhir untuk snippet di daftar kiri
        const pelayanMsgs = messages.filter(m => m.sender === 'pelayan');
        const lastPelayanMsg = pelayanMsgs.length > 0 ? pelayanMsgs[pelayanMsgs.length - 1] : null;
        const lastAnyMsg = messages.length > 0 ? messages[messages.length - 1] : null;

        const wpMsgs = messages.filter(m => m.sender === 'wp');
        const lastWpMsg = wpMsgs.length > 0 ? wpMsgs[wpMsgs.length - 1] : null;

        threads.push({
            // Kolom utama thread (menggunakan id_chat terbaru sebagai referensi aksi)
            id_chat: lastRow.id_chat,
            thread_chat_ids: rows.map(r => r.id_chat),
            id_pengguna: firstRow.id_pengguna,
            id_jadwal: firstRow.id_jadwal,
            isi_pesan: lastPelayanMsg ? lastPelayanMsg.text : (lastRow.isi_pesan || ''),
            timestamp_kirim: lastAnyMsg ? lastAnyMsg.timestamp : lastRow.timestamp_kirim,
            status_baca: lastWpMsg ? lastWpMsg.status_baca : normalizeStatusBaca(lastRow.status_baca),
            status_penanganan: normalizedStatus,
            pesan_balasan: lastWpMsg ? lastWpMsg.text : null,
            timestamp_balas: lastWpMsg ? lastWpMsg.timestamp : null,
            id_penindaklanjut: lastRow.id_penindaklanjut,

            // Array lengkap seluruh bubble pesan untuk dirender terpisah
            messages,

            // Data relasi & kompatibilitas frontend
            id: lastRow.id_chat,
            nama: namaPengirim,
            role_pengirim: pengirim ? pengirim.role : 'Servant',
            nama_penindaklanjut: penindaklanjut ? (penindaklanjut.nama_lengkap || '').trim() : 'Worship Planner',
            judul_pelayanan: judulPelayanan,
            tanggal_pelayanan: tanggalRaw,
            jadwal_tanggal: jadwalTanggalFormatted,
            alasan: lastPelayanMsg ? lastPelayanMsg.text : (lastRow.isi_pesan || ''),
            status: normalizedStatus,
            created_at: lastAnyMsg ? lastAnyMsg.timestamp : lastRow.timestamp_kirim
        });
    }

    // Urutkan daftar thread agar percakapan dengan aktivitas terbaru berada di paling atas
    threads.sort((a, b) => {
        const ta = a.timestamp_kirim ? new Date(a.timestamp_kirim).getTime() : 0;
        const tb = b.timestamp_kirim ? new Date(b.timestamp_kirim).getTime() : 0;
        return tb - ta;
    });

    if (filters.status) {
        const s = filters.status.toLowerCase();
        if (s === 'belum diproses' || s === 'sedang proses' || s === 'proses' || s === 'menunggu') {
            threads = threads.filter(item => item.status_penanganan !== 'Selesai');
        } else if (s === 'selesai') {
            threads = threads.filter(item => item.status_penanganan === 'Selesai');
        }
    }

    return threads;
}

/**
 * Helper: Mencari ID penindaklanjut default (Worship Planner / Admin) untuk memenuhi constraint NOT NULL
 */
async function resolveDefaultPenindaklanjutId(preferredId = null, fallbackUserId = null) {
    if (preferredId && !isNaN(parseInt(preferredId, 10))) {
        return parseInt(preferredId, 10);
    }

    const { data: users } = await supabase.from('pengguna').select('id_pengguna, role');
    if (users && users.length > 0) {
        const wp = users.find(u => u.role && (u.role.toLowerCase() === 'worship planner' || u.role.toLowerCase() === 'wp'));
        if (wp) return Number(wp.id_pengguna);

        const admin = users.find(u => u.role && u.role.toLowerCase() === 'admin');
        if (admin) return Number(admin.id_pengguna);

        return Number(users[0].id_pengguna);
    }
    return fallbackUserId ? parseInt(fallbackUserId, 10) : 1;
}

/**
 * 1. GET /api/berhalangan
 * Mengambil semua percakapan izin berhalangan dari tabel chat_berhalangan
 */
router.get('/', async (req, res) => {
    try {
        const { status, id_jadwal, id_pengguna } = req.query;
        const data = await fetchChatsWithRelations({ status, id_jadwal, id_pengguna });
        res.json({ success: true, data });
    } catch (err) {
        console.error('[Berhalangan API Error] GET /:', err.message);
        res.status(500).json({ success: false, message: err.message, data: [] });
    }
});

/**
 * 2. GET /api/berhalangan/:id
 * Mengambil detail 1 percakapan berhalangan berdasarkan id_chat
 */
router.get('/:id', async (req, res) => {
    try {
        const rows = await fetchChatsWithRelations({ id_chat: req.params.id });
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 3. POST /api/berhalangan
 * Pelayan yang terjadwal mengirim pesan izin berhalangan baru (selalu INSERT baris baru = bubble baru)
 */
router.post('/', async (req, res) => {
    const { id_pengguna, nama, email, id_jadwal, isi_pesan, alasan } = req.body;
    const finalPesan = (isi_pesan || alasan || '').trim();

    if (!finalPesan) {
        return res.status(400).json({ success: false, message: 'Pesan alasan izin wajib diisi!' });
    }
    if (!id_jadwal || isNaN(parseInt(id_jadwal, 10))) {
        return res.status(400).json({ success: false, message: 'ID Jadwal wajib disertakan!' });
    }

    const parsedJadwalId = parseInt(id_jadwal, 10);

    try {
        // 1. Ambil daftar penugasan pada jadwal ini (gunakan select('*') agar tidak bergantung pada nama kolom PK)
        const { data: jadwalTugasRows } = await supabase
            .from('jadwal_tugas')
            .select('*')
            .eq('id_jadwal', parsedJadwalId);

        const tugasList = Array.isArray(jadwalTugasRows) ? jadwalTugasRows : [];

        // 2. Tentukan id_pengguna yang valid dari tabel pengguna & jadwal_tugas
        let resolvedUserId = (id_pengguna && !isNaN(parseInt(id_pengguna, 10)))
            ? parseInt(id_pengguna, 10)
            : null;

        const { data: allUsers } = await supabase.from('pengguna').select('*');
        const userList = Array.isArray(allUsers) ? allUsers : [];

        // Prioritaskan pencocokan terhadap pelayan yang memang terdaftar di jadwal_tugas pada jadwal ini
        let matchedTugas = null;
        if (resolvedUserId) {
            matchedTugas = tugasList.find(t => Number(t.id_pengguna) === resolvedUserId);
        }
        if (!matchedTugas && nama) {
            const cleanNama = nama.trim().toLowerCase();
            matchedTugas = tugasList.find(t => {
                const u = userList.find(usr => Number(usr.id_pengguna) === Number(t.id_pengguna));
                return u && u.nama_lengkap && u.nama_lengkap.trim().toLowerCase() === cleanNama;
            });
        }
        if (!matchedTugas && email) {
            const cleanEmail = email.trim().toLowerCase();
            matchedTugas = tugasList.find(t => {
                const u = userList.find(usr => Number(usr.id_pengguna) === Number(t.id_pengguna));
                return u && u.email && u.email.trim().toLowerCase() === cleanEmail;
            });
        }

        if (matchedTugas) {
            resolvedUserId = Number(matchedTugas.id_pengguna);
        } else if (userList.length > 0) {
            if (resolvedUserId && !userList.some(u => Number(u.id_pengguna) === resolvedUserId)) {
                resolvedUserId = null;
            }
            if (!resolvedUserId && email) {
                const byEmail = userList.find(u => u.email && u.email.trim().toLowerCase() === email.trim().toLowerCase());
                if (byEmail) resolvedUserId = Number(byEmail.id_pengguna);
            }
            if (!resolvedUserId && nama) {
                const byName = userList.find(u => u.nama_lengkap && u.nama_lengkap.trim().toLowerCase() === nama.trim().toLowerCase());
                if (byName) resolvedUserId = Number(byName.id_pengguna);
            }
        }

        if (!resolvedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Akun pengguna tidak ditemukan di database.'
            });
        }

        // Pastikan pengguna memang terjadwal bertugas pada jadwal ini
        const isAssignedInJadwal = Boolean(
            matchedTugas || tugasList.some(t => Number(t.id_pengguna) === Number(resolvedUserId))
        );

        if (!isAssignedInJadwal) {
            return res.status(403).json({
                success: false,
                message: 'Hanya pelayan yang terdaftar bertugas pada jadwal ini yang dapat mengirim pesan berhalangan.'
            });
        }

        // 3. Cek apakah sudah ada baris sebelumnya pada thread (id_jadwal, id_pengguna) ini untuk mewarisi status/penindaklanjut
        const { data: prevRows } = await supabase
            .from('chat_berhalangan')
            .select('*')
            .eq('id_jadwal', parsedJadwalId)
            .eq('id_pengguna', resolvedUserId)
            .order('id_chat', { ascending: false })
            .limit(1);

        const prevRow = (prevRows && prevRows.length > 0) ? prevRows[0] : null;
        const penindaklanjutId = await resolveDefaultPenindaklanjutId(
            prevRow ? prevRow.id_penindaklanjut : null,
            resolvedUserId
        );
        const currentStatusPenanganan = prevRow && prevRow.status_penanganan
            ? prevRow.status_penanganan
            : 'Sedang Proses';

        // 4. Selalu INSERT baris baru agar menjadi bubble baru dengan timestamp_kirim sendiri
        const newRecord = {
            id_pengguna: resolvedUserId,
            id_jadwal: parsedJadwalId,
            isi_pesan: finalPesan,
            timestamp_kirim: getLocalTimestampStr(),
            status_baca: 'Belum Dibaca',
            status_penanganan: currentStatusPenanganan,
            pesan_balasan: null,
            timestamp_balas: null,
            id_penindaklanjut: penindaklanjutId
        };

        const { data: inserted, error: insErr } = await supabase
            .from('chat_berhalangan')
            .insert([newRecord])
            .select();

        if (insErr) throw insErr;

        const createdList = await fetchChatsWithRelations({
            id_jadwal: parsedJadwalId,
            id_pengguna: resolvedUserId
        });
        res.status(201).json({
            success: true,
            message: 'Pesan izin berhalangan berhasil dikirim',
            data: createdList[0]
        });
    } catch (err) {
        console.error('[Berhalangan API Error] POST /:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 4. PUT /api/berhalangan/:id/balas
 * Worship Planner mengirim balasan (atau Pelayan mengirim pesan lanjutan dari halaman Detail Jadwal)
 */
router.put('/:id/balas', async (req, res) => {
    const id_chat = parseInt(req.params.id, 10);
    const { pesan_balasan, id_penindaklanjut, sender_type, isi_pesan } = req.body;

    try {
        const { data: current, error: getErr } = await supabase
            .from('chat_berhalangan')
            .select('*')
            .eq('id_chat', id_chat)
            .single();

        if (getErr || !current) {
            return res.status(404).json({ success: false, message: 'Data percakapan tidak ditemukan' });
        }

        const threadJadwalId = Number(current.id_jadwal);
        const threadPenggunaId = Number(current.id_pengguna);

        // Ambil seluruh baris dalam thread ini
        const { data: threadRows } = await supabase
            .from('chat_berhalangan')
            .select('*')
            .eq('id_jadwal', threadJadwalId)
            .eq('id_pengguna', threadPenggunaId)
            .order('id_chat', { ascending: true });

        const latestRow = (threadRows && threadRows.length > 0)
            ? threadRows[threadRows.length - 1]
            : current;

        // Jika pengirim adalah pelayan dari halaman detail-jadwal -> INSERT baris baru agar jadi bubble baru!
        if (sender_type === 'pelayan') {
            const textPelayan = (isi_pesan || pesan_balasan || '').trim();
            if (!textPelayan) {
                return res.status(400).json({ success: false, message: 'Isi balasan tidak boleh kosong' });
            }

            // Pastikan pelayan memang terdaftar bertugas di jadwal ini
            const { data: tugasRows } = await supabase
                .from('jadwal_tugas')
                .select('*')
                .eq('id_jadwal', threadJadwalId)
                .eq('id_pengguna', threadPenggunaId);

            if (!tugasRows || tugasRows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Hanya pelayan yang terdaftar bertugas pada jadwal ini yang dapat mengirim pesan.'
                });
            }

            const newPelayanRecord = {
                id_pengguna: threadPenggunaId,
                id_jadwal: threadJadwalId,
                isi_pesan: textPelayan,
                timestamp_kirim: getLocalTimestampStr(),
                status_baca: 'Belum Dibaca',
                status_penanganan: latestRow.status_penanganan || 'Sedang Proses',
                pesan_balasan: null,
                timestamp_balas: null,
                id_penindaklanjut: latestRow.id_penindaklanjut
            };

            const { error: insErr } = await supabase
                .from('chat_berhalangan')
                .insert([newPelayanRecord]);

            if (insErr) throw insErr;
        } else {
            // Pengirim adalah Worship Planner dari halaman Berhalangan
            const textBalasan = (pesan_balasan || '').trim();
            if (!textBalasan) {
                return res.status(400).json({ success: false, message: 'Pesan balasan tidak boleh kosong' });
            }

            const finalPenindaklanjut = await resolveDefaultPenindaklanjutId(
                id_penindaklanjut || latestRow.id_penindaklanjut,
                threadPenggunaId
            );

            const nextStatus = latestRow.status_penanganan === 'Selesai' ? 'Selesai' : 'Sedang Proses';
            const nowStr = getLocalTimestampStr();

            // Jika baris terakhir belum punya pesan_balasan, isi pesan_balasan pada baris terakhir tersebut
            if (!latestRow.pesan_balasan) {
                const { error: updErr } = await supabase
                    .from('chat_berhalangan')
                    .update({
                        pesan_balasan: textBalasan,
                        timestamp_balas: nowStr,
                        status_baca: 'Belum Dibaca',
                        status_penanganan: nextStatus,
                        id_penindaklanjut: finalPenindaklanjut
                    })
                    .eq('id_chat', latestRow.id_chat);

                if (updErr) throw updErr;
            } else {
                // Jika baris terakhir sudah punya pesan_balasan (WP kirim pesan beruntun), buat baris baru khusus bubble WP
                const newWpRecord = {
                    id_pengguna: threadPenggunaId,
                    id_jadwal: threadJadwalId,
                    isi_pesan: '-',
                    timestamp_kirim: nowStr,
                    status_baca: 'Belum Dibaca',
                    status_penanganan: nextStatus,
                    pesan_balasan: textBalasan,
                    timestamp_balas: nowStr,
                    id_penindaklanjut: finalPenindaklanjut
                };

                const { error: insErr } = await supabase
                    .from('chat_berhalangan')
                    .insert([newWpRecord]);

                if (insErr) throw insErr;
            }
        }

        const updated = await fetchChatsWithRelations({
            id_jadwal: threadJadwalId,
            id_pengguna: threadPenggunaId
        });
        res.json({
            success: true,
            message: 'Balasan berhasil dikirim',
            data: updated[0]
        });
    } catch (err) {
        console.error('[Berhalangan API Error] PUT /:id/balas:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 5. PUT /api/berhalangan/:id/selesai
 * Menandai seluruh baris dalam thread permintaan berhalangan sebagai "Selesai" (Pengganti Ditemukan)
 */
router.put('/:id/selesai', async (req, res) => {
    const id_chat = parseInt(req.params.id, 10);
    const { pesan_balasan, id_penindaklanjut } = req.body || {};

    try {
        const { data: current, error: getErr } = await supabase
            .from('chat_berhalangan')
            .select('*')
            .eq('id_chat', id_chat)
            .single();

        if (getErr || !current) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }

        const threadJadwalId = Number(current.id_jadwal);
        const threadPenggunaId = Number(current.id_pengguna);

        const finalPenindaklanjut = await resolveDefaultPenindaklanjutId(
            id_penindaklanjut || current.id_penindaklanjut,
            threadPenggunaId
        );

        // Jika ada pesan_balasan opsional saat klik Pengganti Ditemukan
        if (pesan_balasan && pesan_balasan.trim()) {
            const extraReply = pesan_balasan.trim();
            const nowStr = getLocalTimestampStr();

            if (!current.pesan_balasan) {
                await supabase
                    .from('chat_berhalangan')
                    .update({
                        pesan_balasan: extraReply,
                        timestamp_balas: nowStr,
                        status_baca: 'Belum Dibaca',
                        id_penindaklanjut: finalPenindaklanjut
                    })
                    .eq('id_chat', current.id_chat);
            } else {
                await supabase
                    .from('chat_berhalangan')
                    .insert([{
                        id_pengguna: threadPenggunaId,
                        id_jadwal: threadJadwalId,
                        isi_pesan: '-',
                        timestamp_kirim: nowStr,
                        status_baca: 'Belum Dibaca',
                        status_penanganan: 'Selesai',
                        pesan_balasan: extraReply,
                        timestamp_balas: nowStr,
                        id_penindaklanjut: finalPenindaklanjut
                    }]);
            }
        }

        // Tandai semua baris dalam thread (id_jadwal, id_pengguna) ini menjadi 'Selesai'
        const { error: updErr } = await supabase
            .from('chat_berhalangan')
            .update({
                status_penanganan: 'Selesai',
                id_penindaklanjut: finalPenindaklanjut
            })
            .eq('id_jadwal', threadJadwalId)
            .eq('id_pengguna', threadPenggunaId);

        if (updErr) throw updErr;

        const updated = await fetchChatsWithRelations({
            id_jadwal: threadJadwalId,
            id_pengguna: threadPenggunaId
        });
        res.json({
            success: true,
            message: 'Status berhalangan diperbarui menjadi Selesai',
            data: updated[0]
        });
    } catch (err) {
        console.error('[Berhalangan API Error] PUT /:id/selesai:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 6. PUT /api/berhalangan/:id/baca
 * Menandai semua balasan WP dalam thread tersebut sudah dibaca ('Dibaca') oleh pelayan
 */
router.put('/:id/baca', async (req, res) => {
    const id_chat = parseInt(req.params.id, 10);
    try {
        const { data: current, error: getErr } = await supabase
            .from('chat_berhalangan')
            .select('id_jadwal, id_pengguna')
            .eq('id_chat', id_chat)
            .single();

        if (getErr || !current) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }

        const { error } = await supabase
            .from('chat_berhalangan')
            .update({ status_baca: 'Dibaca' })
            .eq('id_jadwal', current.id_jadwal)
            .eq('id_pengguna', current.id_pengguna);

        if (error) throw error;

        const updated = await fetchChatsWithRelations({
            id_jadwal: current.id_jadwal,
            id_pengguna: current.id_pengguna
        });
        res.json({ success: true, data: updated[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * 7. DELETE /api/berhalangan/:id
 */
router.delete('/:id', async (req, res) => {
    const id_chat = parseInt(req.params.id, 10);
    try {
        const { error } = await supabase.from('chat_berhalangan').delete().eq('id_chat', id_chat);
        if (error) throw error;
        res.json({ success: true, message: 'Data berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
