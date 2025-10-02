import { supabaseUrl, supabaseAnonKey } from './config.js';

// --- Yetki Kontrolü ve Anasayfa Linklerinin Yönetimi ---
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: ()=>{}, removeItem: ()=>{} };
const supabaseAuth = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });

async function checkAuthAndApplyPermissions() {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data: { user } } = await supabaseAuth.auth.getUser();
    const permissions = user?.user_metadata?.permissions || [];

    const cekimTakipLink = document.getElementById('cekim-takip-link');
    const monitoringLink = document.getElementById('monitoring-link');
    const paymentLink = document.getElementById('payment-link');

    function deactivateLink(link) {
        if (link) {
            link.removeAttribute('href');
            link.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
    
    if (permissions.includes('admin')) {
        return; 
    }

    if (!permissions.includes('view_cekim')) {
        deactivateLink(cekimTakipLink);
    }
    if (!permissions.includes('view_izleme')) {
        deactivateLink(monitoringLink);
    }
    if (!permissions.includes('view_odeme')) {
        deactivateLink(paymentLink);
    }
}

document.addEventListener('DOMContentLoaded', checkAuthAndApplyPermissions);


// --- Çıkış Butonu İşlevselliği ---
const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener('click', async () => {
    const mainStorageAdapter = {
        getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
        setItem: (key, value) => { localStorage.setItem(key, value); sessionStorage.setItem(key, value); },
        removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); },
    };
    const supabase_logout = supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { storage: mainStorageAdapter }
    });
    await supabase_logout.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});
