// Membaca variabel rahasia dari file .env
require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk mem-parsing JSON (berguna untuk fitur selanjutnya)
app.use(express.json());

// Menyajikan semua file statis (HTML, CSS, JS) di dalam folder 'public'
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// RUTE API (BACKEND)
// ==========================================

// Endpoint untuk mengirimkan kunci Supabase ke file frontend (auth.js & dashboard.html)
app.get('/api/config', (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});


// ==========================================
// RUTE HALAMAN (FRONTEND)
// ==========================================

// Rute untuk halaman utama (Login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rute untuk halaman Dashboard (Setelah Login)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});


// ==========================================
// JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`Server SI Pelayanan berjalan di http://localhost:${PORT}`);
});

const laguRoutes = require('./routes/laguRoutes');
app.use('/api/lagu', laguRoutes);