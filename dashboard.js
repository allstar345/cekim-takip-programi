import { supabaseUrl, supabaseAnonKey } from './config.js';

// --- Yetki Kontrolü ve Anasayfa Linklerinin Yönetimi ---
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key) };
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });

document.addEventListener('DOMContentLoaded', () => {
    console.log("Yetki kontrolü devre dışı - tüm bağlantılar aktif.");
});

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
