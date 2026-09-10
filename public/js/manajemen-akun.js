let allAccounts = [];

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
    // Tunggu authReady dari layout.js/dashboard.html (jika scriptnya dipasang)
    if (window.authReady) await window.authReady;
    
    const supabase = window.supabaseClient;
    if(!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js akan mengurus redirect ke login
    
    const email = session.user.email;
    const role = session.user.user_metadata?.role || 'Guest';
    
    // Berikan akses otomatis ke admin default (email Anda) tanpa harus cek role metadata
    const defaultAdmins = ['matthewanders2709@gmail.com', 'hydroxx27@gmail.com'];

    if (role !== 'Admin' && !defaultAdmins.includes(email)) {
        alert('Akses Ditolak: Halaman ini hanya untuk Admin.');
        window.location.href = '/dashboard.html';
    }
}

async function fetchAkun() {
    try {
        const response = await fetch('/api/akun');
        if (!response.ok) throw new Error('Gagal mengambil data akun');
        
        allAccounts = await response.json();
        renderTable(allAccounts);
        updateTotalText(allAccounts.length);
    } catch (error) {
        console.error(error);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
    }
}

function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada data ditemukan.</td></tr>`;
        return;
    }

    data.forEach(akun => {
        const tr = document.createElement('tr');
        
        // Buat ID unik untuk class CSS (menghilangkan spasi)
        const roleClass = `role-${akun.role.replace(/\s+/g, '').toLowerCase()}`;

        tr.innerHTML = `
            <td>${akun.nama_lengkap}</td>
            <td>${akun.email_gmail}</td>
            <td>
                <select class="role-select ${roleClass}" onchange="handleRoleChange('${akun.email_gmail}', this)">
                    <option value="Admin" ${akun.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Worship Planner" ${akun.role === 'Worship Planner' ? 'selected' : ''}>Worship Planner</option>
                    <option value="Worship Leader" ${akun.role === 'Worship Leader' ? 'selected' : ''}>Worship Leader</option>
                    <option value="Music Director" ${akun.role === 'Music Director' ? 'selected' : ''}>Music Director</option>
                    <option value="Servant" ${akun.role === 'Servant' ? 'selected' : ''}>Servant</option>
                </select>
            </td>
            <td style="text-align: right;">
                <button class="btn-delete" onclick="handleHapusAkun('${akun.email_gmail}')">
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

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = allAccounts.filter(akun => 
        akun.nama_lengkap.toLowerCase().includes(query) || 
        akun.email_gmail.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

async function handleTambahAkun(e) {
    e.preventDefault();
    const nama = document.getElementById('input-nama').value;
    const email = document.getElementById('input-email').value;
    const role = document.getElementById('input-role').value;

    try {
        const response = await fetch('/api/akun', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama_lengkap: nama, email_gmail: email, role: role })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal menambah akun');

        alert('Berhasil menambah akun!');
        document.getElementById('form-tambah-akun').reset();
        await fetchAkun(); // Refresh tabel

    } catch (error) {
        alert(error.message);
    }
}

async function handleRoleChange(email, selectElement) {
    const newRole = selectElement.value;
    
    // Ganti class warna background dropdown sesuai role baru
    selectElement.className = `role-select role-${newRole.replace(/\\s+/g, '').toLowerCase()}`;

    try {
        const response = await fetch(`/api/akun/${email}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Gagal mengubah role');
        }
        
        // Refresh array lokal agar search tetap akurat
        const index = allAccounts.findIndex(a => a.email_gmail === email);
        if(index > -1) allAccounts[index].role = newRole;

    } catch (error) {
        alert('Gagal memperbarui Role: ' + error.message);
        await fetchAkun(); // Revert back jika gagal
    }
}

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
        await fetchAkun(); // Refresh tabel
    } catch (error) {
        alert(error.message);
    }
}
