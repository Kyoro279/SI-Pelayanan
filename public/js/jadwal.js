document.addEventListener('DOMContentLoaded', () => {
    console.log('Jadwal Pelayanan script loaded');

    // Listener Tambah Jadwal
    const btnTambah = document.getElementById('btn-tambah-jadwal');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => {
            // Logika untuk menampilkan Modal / Redirect Form Tambah Jadwal
            alert('Fitur Tambah Jadwal Klik');
        });
    }

    // Listener Tombol Hapus pada Kartu
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (confirm('Apakah Anda yakin ingin menghapus jadwal pelayanan ini?')) {
                // Panggil API penghapusan di jadwalRoutes.js di sini
                const card = e.target.closest('.schedule-card');
                if (card) {
                    card.remove();
                }
            }
        });
    });

    // Contoh tempat memasukkan Fetch API dari backend `routes/jadwalRoutes.js`
    /*
    async function loadJadwalData() {
        try {
            const response = await fetch('/api/jadwal');
            const data = await response.json();
            // Render data ke DOM
        } catch (error) {
            console.error('Error fetching jadwal:', error);
        }
    }
    loadJadwalData();
    */
});