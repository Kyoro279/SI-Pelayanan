const SIDEBAR_CACHE_KEY = 'kitteens_sidebar_html_v2';

/**
 * Fungsi global untuk menampilkan pop up notifikasi kotak di tengah layar beserta ikon status
 * @param {string} message - Pesan pemberitahuan (contoh: "Jadwal Berhasil Ditambahkan")
 * @param {'success'|'error'|'warning'} type - Tipe pop up ('success', 'error', 'warning')
 * @param {number} duration - Durasi tampil dalam milidetik sebelum tertutup otomatis
 * @returns {Promise<void>}
 */
window.showPopupAlert = function (message, type = 'success', duration = 1400) {
    return new Promise((resolve) => {
        // hapus pop up lama jika masih ada
        const existing = document.getElementById('global-popup-alert-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'global-popup-alert-overlay';
        overlay.className = 'popup-alert-overlay';

        let iconClass = 'ph-fill ph-check-circle';
        if (type === 'error') iconClass = 'ph-fill ph-x-circle';
        else if (type === 'warning') iconClass = 'ph-fill ph-warning-circle';

        overlay.innerHTML = `
            <div class="popup-alert-box">
                <div class="popup-alert-icon ${type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="popup-alert-text"></div>
            </div>
        `;

        const textEl = overlay.querySelector('.popup-alert-text');
        if (textEl) textEl.textContent = message;

        document.body.appendChild(overlay);

        // trigger animasi masuk
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        let closed = false;
        const closePopup = () => {
            if (closed) return;
            closed = true;
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 180);
        };

        overlay.addEventListener('click', closePopup);
        setTimeout(closePopup, duration);
    });
};

/**
 * Fungsi global untuk menampilkan pop up konfirmasi kotak di tengah layar (pengganti window.confirm)
 * @param {string} message - Pesan pertanyaan konfirmasi
 * @param {object} options - Opsi tambahan ({ title, confirmText, cancelText })
 * @returns {Promise<boolean>} - true jika klik Ya/Hapus, false jika klik Batal
 */
window.showPopupConfirm = function (message, options = {}) {
    return new Promise((resolve) => {
        const existing = document.getElementById('global-popup-confirm-overlay');
        if (existing) existing.remove();

        const titleText = options.title || 'Konfirmasi Hapus';
        const confirmText = options.confirmText || 'Hapus';
        const cancelText = options.cancelText || 'Batal';

        const overlay = document.createElement('div');
        overlay.id = 'global-popup-confirm-overlay';
        overlay.className = 'popup-alert-overlay';

        overlay.innerHTML = `
            <div class="popup-alert-box confirm-box">
                <div class="popup-alert-icon error">
                    <i class="ph-fill ph-trash"></i>
                </div>
                <div class="popup-confirm-title"></div>
                <div class="popup-confirm-desc"></div>
                <div class="popup-confirm-actions">
                    <button type="button" class="btn-popup-cancel" id="btn-popup-cancel-act"></button>
                    <button type="button" class="btn-popup-confirm" id="btn-popup-confirm-act"></button>
                </div>
            </div>
        `;

        overlay.querySelector('.popup-confirm-title').textContent = titleText;
        overlay.querySelector('.popup-confirm-desc').textContent = message;
        overlay.querySelector('#btn-popup-cancel-act').textContent = cancelText;
        overlay.querySelector('#btn-popup-confirm-act').textContent = confirmText;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        let resolved = false;
        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 180);
        };

        overlay.querySelector('#btn-popup-cancel-act').addEventListener('click', () => finish(false));
        overlay.querySelector('#btn-popup-confirm-act').addEventListener('click', () => finish(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) finish(false);
        });
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch dan Inject Sidebar (gunakan cache sessionStorage agar pindah halaman tidak kedip/lambat)
    try {
        let sidebarHTML = null;
        try {
            sidebarHTML = sessionStorage.getItem(SIDEBAR_CACHE_KEY);
        } catch (_) { }

        if (!sidebarHTML) {
            const response = await fetch('/components/sidebar.html');
            if (!response.ok) throw new Error('Gagal memuat sidebar');
            sidebarHTML = await response.text();
            try {
                sessionStorage.setItem(SIDEBAR_CACHE_KEY, sidebarHTML);
            } catch (_) { }
        }

        document.getElementById('sidebar-container').innerHTML = sidebarHTML;
        
        // 2. Set Menu Aktif berdasarkan URL atau Atribut Data
        setActiveMenu();

        // 3. Setup Navigasi Mobile (Hamburger Drawer)
        setupMobileSidebarToggle();

        // 4. Setup Fungsi Sidebar (User info & Logout)
        setupSidebarLogic();

    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
});

function setupMobileSidebarToggle() {
    const sidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const overlay = document.getElementById('sidebar-overlay');

    if (!sidebar) return;

    const openSidebar = () => {
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

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
        const menuReport = document.querySelector('.sidebar-menu a[data-menu="report"]');

        if (role !== 'admin' && !isSuperAdmin) {
            if (menuAkun) menuAkun.parentElement.style.display = 'none';
        }

        const isAdminOrWp = isSuperAdmin || role === 'admin' || role === 'worship planner' || role === 'wp';
        if (!isAdminOrWp) {
            if (menuBerhalangan) menuBerhalangan.parentElement.style.display = 'none';
            if (menuHistory) menuHistory.parentElement.style.display = 'none';
            if (menuReport) menuReport.parentElement.style.display = 'none';
        }
    }

    // Logika Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                sessionStorage.removeItem('kitteens_user_data_v1');
                sessionStorage.removeItem(SIDEBAR_CACHE_KEY);
            } catch (_) { }
            const { error } = await supabase.auth.signOut();
            if (error) {
                alert('Gagal logout: ' + error.message);
            } else {
                window.location.href = '/'; // Redirect ke halaman login
            }
        });
    }
}
