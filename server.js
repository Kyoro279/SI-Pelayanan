// Membaca variabel rahasia dari file .env
require('dotenv').config();

const express = require('express');
const path = require('path');

// Import Routes API
const laguRoutes = require('./routes/laguRoutes');
const akunRoutes = require('./routes/akunRoutes');
const jadwalRoutes = require('./routes/jadwalRoutes');
const berhalanganRoutes = require('./routes/berhalanganRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk mem-parsing JSON
app.use(express.json());

// Menyajikan semua file statis (HTML, CSS, JS) di dalam folder 'public'
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// RUTE API (BACKEND)
// ==========================================

// Endpoint untuk mengirimkan kunci Supabase ke file frontend
app.get('/api/config', (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

// Pendaftaran endpoint API routes
app.use('/api/lagu', laguRoutes);
app.use('/api/akun', akunRoutes);
app.use('/api/jadwal', jadwalRoutes);
app.use('/api/berhalangan', berhalanganRoutes);


// ==========================================
// RUTE HALAMAN (FRONTEND)
// ==========================================

// Rute untuk halaman utama (Login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rute untuk halaman Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rute untuk halaman Bank Lagu
app.get('/bank-lagu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bank-lagu.html'));
});

// Rute untuk halaman Detail Lagu
app.get('/detail-lagu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'detail-lagu.html'));
});

// Rute untuk halaman Edit Lagu
app.get('/edit-lagu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'edit-lagu.html'));
});

// Rute untuk halaman Tambah Lagu
app.get('/tambah-lagu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tambah-lagu.html'));
});

// Rute untuk halaman Manajemen Akun
app.get('/manajemen-akun', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manajemen-akun.html'));
});

// Rute untuk halaman Jadwal Pelayanan
app.get('/jadwal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jadwal.html'));
});

// Rute untuk halaman Berhalangan
app.get('/berhalangan', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'berhalangan.html'));
});
// Rute untuk halaman Rekap History
app.get('/rekap-history', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rekap-history.html'));
});



// ==========================================
// JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`Server SI Pelayanan berjalan di http://localhost:${PORT}`);
});
