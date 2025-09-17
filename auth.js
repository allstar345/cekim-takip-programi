// Bu scriptin çalışması için supabase-client.js'nin önce yüklenmesi gerekir.

async function checkAuthAndPermissions(pagePermission) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return; // Oturum yoksa, anında yönlendir ve çık
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email;
    const permissions = PERMISSIONS_MAP[userEmail] || []; // Kullanıcı haritada yoksa, boş bir yetki listesi ata

    // Admin her sayfaya girebilir
    if (permissions.includes('admin')) {
        return;
    }

    // Sayfa bir yetki gerektiriyorsa ve kullanıcının o yetkisi yoksa, engelle
    if (pagePermission && !permissions.includes(pagePermission)) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}

function handleLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            // Tarayıcıda kalıntı kalmaması için önbelleği temizle
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
}

// Bu script'in dahil olduğu her sayfada, sayfa yüklendiğinde Çıkış Yap butonuna fonksiyonelliği ekle
document.addEventListener('DOMContentLoaded', handleLogout);
