let allAccounts = []; //menyimpan data sementara di browser agar proses berjalan cepat tidak perlu request database terus menerus

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Otorisasi: Pastikan yang masuk adalah Admin
    await checkAdminAuth();

    // 2. Fetch Data Awal
    await fetchAkun();

    // 3. Event Listener Form Tambah
    document.getElementById('form-tambah-akun').addEventListener('submit', handleTambahAkun);

    // 4. Event Listener Search
    document.getElementById('search-input').addEventListener('input', handleSearch);
});

async function checkAdminAuth() {
    // Tunggu authReady dari layout.js/dashboard.html/manajemen-akun.html
    if (window.authReady) await window.authReady;
}

// narik data akun dari backend pas halaman pertama dibuka
async function fetchAkun() {
    try {
        const response = await fetch('/api/akun');
        if (!response.ok) throw new Error('Gagal mengambil data akun');

        allAccounts = await response.json(); // Simpan ke variabel global
        renderTable(allAccounts);            // Gambar tabelnya
        updateTotalText(allAccounts.length); // Update teks "X Akun Terdaftar"
    } catch (error) {
        console.error(error);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
    }
}

// ngebangun baris tabel (html tr td) pake javascript dari data array 
function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = ''; // Kosongkan tabel sebelum menggambar yang baru

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada data ditemukan.</td></tr>`;
        return;
    }

    data.forEach(akun => {
        const tr = document.createElement('tr');

        const safeRole = akun.role || 'Servant'; // Fallback kalo di database kosong, anggap aja Servant
        // Buat ID unik untuk class CSS warna Role
        const roleClass = `role-${safeRole.replace(/\s+/g, '').toLowerCase()}`;

        tr.innerHTML = `
            <td>${akun.nama_lengkap}</td>
            <td>${akun.email}</td>
            <td>
                <!-- Dropdown Role yang langsung memicu handleRoleChange jika dipilih -->
                <select class="role-select ${roleClass}" onchange="handleRoleChange('${akun.email}', this)">
                    <option value="Admin" ${safeRole === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Worship Planner" ${safeRole === 'Worship Planner' ? 'selected' : ''}>Worship Planner</option>
                    <option value="Worship Leader" ${safeRole === 'Worship Leader' ? 'selected' : ''}>Worship Leader</option>
                    <option value="Music Director" ${safeRole === 'Music Director' ? 'selected' : ''}>Music Director</option>
                    <option value="Servant" ${safeRole === 'Servant' ? 'selected' : ''}>Servant</option>
                </select>
            </td>
            <td style="text-align: right; white-space: nowrap;">
                <!-- Tombol Edit Nama & Email -->
                <button class="btn-edit" onclick="handleEditMode(this, '${akun.email}', '${akun.nama_lengkap}')" title="Edit">
                    <i class="ph ph-pencil-simple"></i>
                </button>
                <!-- Tombol Hapus Akun -->
                <button class="btn-delete" onclick="handleHapusAkun('${akun.email}')">
                    <i class="ph ph-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateTotalText(count) {
    document.getElementById('total-accounts-text').textContent = `${count} Akun Terdaftar`;
}

//menyaring daftar all account , mencocokan teks yang diketik dengan nama yang ada di database
function handleSearch(e) {
    const query = e.target.value.toLowerCase(); //mengambil teks yang diketik 
    //membuat array baru berisi data yang cocok dengan teks yang diketik 
    const filtered = allAccounts.filter(akun =>
        akun.nama_lengkap.toLowerCase().includes(query) ||
        akun.email.toLowerCase().includes(query)
    );
    renderTable(filtered); //menampilkan data yang cocok
}

// fungsi buat nambahin akun ke database kalo tombol "Tambah" di-klik
async function handleTambahAkun(e) {
    e.preventDefault(); // Mencegah form melakukan refresh halaman (sifat bawaan HTML)

    // Ambil data dari elemen HTML
    const nama = document.getElementById('input-nama').value;
    const email = document.getElementById('input-email').value;
    const role = document.getElementById('input-role').value;

    try {
        // Kirim request (POST) ke Backend API kita
        const response = await fetch('/api/akun', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama_lengkap: nama, email: email, role: role })
            //data dibungkus menjadi format JSON dan dikirim ke backend server
        });

        const result = await response.json();

        // Jika server membalas dengan status selain 2xx (artinya gagal)
        if (!response.ok) throw new Error(result.error || 'Gagal menambah akun');

        alert('Berhasil menambah akun!');
        document.getElementById('form-tambah-akun').reset(); // Kosongkan form kembali

        // Tarik ulang data dari database agar data yang baru ditambahkan langsung muncul di tabel
        await fetchAkun();

    } catch (error) {
        alert(error.message);
    }
}

// lgsg update role ke backend pas user milih dari dropdown
async function handleRoleChange(email, selectElement) {
    const newRole = selectElement.value; // Dapatkan role pilihan yang baru

    // Ganti class warna background dropdown sesuai role baru (misal Admin = merah, dll)
    selectElement.className = `role-select role-${newRole.replace(/\\s+/g, '').toLowerCase()}`;

    try {
        // Kirim request (PUT = Update) ke Backend API
        const response = await fetch(`/api/akun/${email}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Gagal mengubah role');
        }

        // Update data array lokal juga agar kalau user langsung 'Cari', 
        // fiturnya tidak pakai data lama (tidak perlu request data utuh dari DB)
        const index = allAccounts.findIndex(a => a.email === email);
        if (index > -1) allAccounts[index].role = newRole;

    } catch (error) {
        // Jika ada masalah koneksi atau error di backend
        alert('Gagal memperbarui Role: ' + error.message);
        await fetchAkun(); // Tarik lagi data awal yang valid untuk membatalkan (revert) perubahan di layar
    }
}

// hapus akun pake konfirmasi dulu
async function handleHapusAkun(email) {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun dengan email: ${email}?`)) return;

    try {
        const response = await fetch(`/api/akun/${email}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Gagal menghapus akun');
        }

        alert('Akun berhasil dihapus');
        await fetchAkun(); // Refresh tabel setelah dihapus
    } catch (error) {
        alert(error.message);
    }
}

// nyalain mode edit, ganti teks biasa jadi kolom ketikan (input text) pas pensil di-klik
function handleEditMode(button, oldEmail, oldNama) {
    const tr = button.closest('tr');

    // Ganti isi cell nama dengan text input
    const tdNama = tr.children[0];
    tdNama.innerHTML = `<input type="text" class="edit-input-nama" value="${oldNama}" style="width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #CBD5E1; border-radius: 4px; outline: none;">`;

    // Ganti isi cell email dengan text input
    const tdEmail = tr.children[1];
    tdEmail.innerHTML = `<input type="email" class="edit-input-email" value="${oldEmail}" style="width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #CBD5E1; border-radius: 4px; outline: none;">`;

    // Ganti tombol action menjadi tombol Simpan (Check) dan Batal (X)
    const tdAction = tr.children[3];
    tdAction.innerHTML = `
        <button class="btn-edit" onclick="handleSaveEdit(this, '${oldEmail}')" style="color: #10B981;" title="Simpan">
            <i class="ph ph-check-circle"></i>
        </button>
        <button class="btn-delete" onclick="fetchAkun()" title="Batal">
            <i class="ph ph-x-circle" style="color: #64748B;"></i>
        </button>
    `;
}

// simpen hasil editan dari kolom ketikan tadi ke backend
async function handleSaveEdit(button, oldEmail) {
    const tr = button.closest('tr'); // Cari baris (table row) tempat tombol ini berada
    const newNama = tr.querySelector('.edit-input-nama').value.trim();
    const newEmail = tr.querySelector('.edit-input-email').value.trim();

    // Validasi basic (tidak boleh kosong)
    if (!newNama || !newEmail) {
        alert("Nama dan Email tidak boleh kosong");
        return;
    }

    // Jika user menekan simpan tapi tidak ada yang diubah, batalkan edit saja (refresh)
    if (newNama === tr.querySelector('.edit-input-nama').defaultValue && newEmail === oldEmail) {
        fetchAkun();
        return;
    }

    try {
        // Kirim request PUT ke API Backend
        const response = await fetch(`/api/akun/${oldEmail}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama_lengkap: newNama, email: newEmail })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Gagal mengubah data akun');
        }

        // Jika berhasil, refresh tabel secara otomatis
        await fetchAkun();
    } catch (error) {
        alert(error.message);
    }
}
