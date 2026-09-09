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
        // Asumsi data nama dan role disimpan di user_metadata
        const metadata = session.user.user_metadata || {};
        const fullName = metadata.full_name || session.user.email.split('@')[0];
        const role = metadata.role || 'Admin'; // Fallback role
        
        // Update UI Sidebar
        const roleLabel = document.getElementById('sidebar-role-label');
        if(roleLabel) roleLabel.textContent = `Log in sebagai (${role})`;
        
        const userNameOption = document.getElementById('sidebar-user-name');
        if(userNameOption) userNameOption.textContent = `${fullName} - ${role}`;
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
