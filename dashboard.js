import { supabaseUrl, supabaseAnonKey } from './config.js';

// --- Yetki Kontrolü ve Anasayfa Linklerinin Yönetimi ---
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key) };
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });

async function checkAuthAndApplyPermissions() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    const permissions = user?.user_metadata?.permissions || [];

    // Linkleri al
    const cekimTakipLink = document.getElementById('cekim-takip-link');
    const monitoringLink = document.getElementById('monitoring-link');
    const paymentLink = document.getElementById('payment-link');
    const hataBildirimLink = document.getElementById('hata-bildirim-link'); // Yeni link
    const statsPageLink   = document.getElementById('stats-page-link');

    function deactivateLink(link) {
        if (link) {
            link.removeAttribute('href');
            link.classList.add('opacity-50', 'cursor-not-allowed');
            link.addEventListener('click', (e) => e.preventDefault()); // Tıklamayı tamamen engelle
        }
    }
    
    // Admin tüm yetkilere sahip olduğu için kontrol etmeye gerek yok
    if (permissions.includes('admin')) {
        return; 
    }

    // Yetkileri tek tek kontrol et
    if (!permissions.includes('view_cekim')) {
        deactivateLink(cekimTakipLink);
    }
    if (!permissions.includes('view_izleme')) {
        deactivateLink(monitoringLink);
    }
    if (!permissions.includes('view_odeme')) {
        deactivateLink(paymentLink);
    }
    // YENİ EKLENEN KONTROL
    if (!permissions.includes('view_hata_bildirim')) {
        deactivateLink(hataBildirimLink);
    }
    if (!permissions.includes('view_stats')) {
    deactivateLink(statsPageLink);
}
}

document.addEventListener('DOMContentLoaded', checkAuthAndApplyPermissions);


// --- Çıkış Butonu İşlevselliği ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    });
}
