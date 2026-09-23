document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch dan Inject Sidebar
    try {
        const response = await fetch('/components/sidebar.html');
        if (!response.ok) throw new Error('Gagal memuat sidebar');
        
        const sidebarHTML = await response.text();
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;
        
        // 2. Set Menu Aktif berdasarkan URL atau Atribut Data
        setActiveMenu();

        // 3. Setup Fungsi Sidebar (User info & Logout)
        setupSidebarLogic();

    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
});

function setActiveMenu() {
    // Ambil data-active dari body untuk menentukan halaman saat ini
    const activePage = document.body.getAttribute('data-active');
    if (!activePage) return;

    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        if (item.getAttribute('data-menu') === activePage) {
            item.classList.add('active');
        }
    });
}

async function setupSidebarLogic() {
    // Tunggu inisialisasi auth selesai
    if (window.authReady) {
        await window.authReady;
    }

    // Pastikan supabase client sudah diinisialisasi
    const supabase = window.supabaseClient;
    if (!supabase) {
        console.warn('Supabase client tidak ditemukan di layout.js');
        return;
    }

    // Ambil sesi user saat ini
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session && session.user) {
        // Ambil data nama dan role dari window.userData yang diset oleh authReady
        const isSuperAdmin = window.isSuperAdmin;
        const originalRole = window.userData ? window.userData.role : (isSuperAdmin ? 'Admin' : 'Guest');
        const role = originalRole.toLowerCase();
        const metadata = session.user.user_metadata || {};
        const fullName = window.userData ? window.userData.nama_lengkap : (metadata.full_name || session.user.email.split('@')[0]);
        
        // Update UI Sidebar
        const roleLabel = document.getElementById('sidebar-role-label');
        if(roleLabel) roleLabel.textContent = `Log in sebagai (${originalRole})`;
        
        const userNameOption = document.getElementById('sidebar-user-name');
        if(userNameOption) userNameOption.textContent = `${fullName} - ${originalRole}`;

        // Sembunyikan menu berdasarkan role
        const menuAkun = document.querySelector('.sidebar-menu a[data-menu="akun"]');
        const menuBerhalangan = document.querySelector('.sidebar-menu a[data-menu="berhalangan"]');
        const menuHistory = document.querySelector('.sidebar-menu a[data-menu="history"]');

        if (role !== 'admin') {
            if (menuAkun) menuAkun.parentElement.style.display = 'none';
        }

        if (role === 'servant' || role === 'worship leader' || role === 'music director') {
            if (menuBerhalangan) menuBerhalangan.parentElement.style.display = 'none';
            if (menuHistory) menuHistory.parentElement.style.display = 'none';
        }
    }

    // Logika Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                alert('Gagal logout: ' + error.message);
            } else {
                window.location.href = '/'; // Redirect ke halaman login
            }
        });
    }
}
