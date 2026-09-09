// routes/laguRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Endpoint untuk mengambil seluruh daftar lagu
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('lagu').select('*');

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;