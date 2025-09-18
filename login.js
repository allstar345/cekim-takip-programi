// Bu kod, çalışmaya başlamadan önce tüm HTML sayfasının yüklenmesini bekler.
document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';
    const { createClient } = supabase;

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const rememberMeCheckbox = document.getElementById('remember-me');

    // Mevcut bir oturum olup olmadığını kontrol et
    (async () => {
        const authStorageAdapter = {
            getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
            setItem: () => {}, removeItem: () => {}
        };
        const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: authStorageAdapter } });
        const { data: { session } } = await tempSupabase.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
    })();

    // Form gönderildiğinde çalışacak kod
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- DEĞİŞİKLİK BURADA ---
        // Artık kullanıcıdan gelen girdiyi doğrudan e-posta olarak kabul ediyoruz.
        // "@sistem.local" eklemesi kaldırıldı.
        const email = loginForm.username.value;
        const password = loginForm.password.value;
        // --- DEĞİŞİKLİK SONU ---

        errorMessage.classList.add('hidden');

        const storage = rememberMeCheckbox.checked ? localStorage : sessionStorage;
        const customStorageAdapter = {
            getItem: (key) => storage.getItem(key),
            setItem: (key, value) => storage.setItem(key, value),
            removeItem: (key) => storage.removeItem(key),
        };

        const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { storage: customStorageAdapter, },
        });

        const { data, error } = await db.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMessage.textContent = 'E-posta veya şifre hatalı.';
            errorMessage.classList.remove('hidden');
            console.error('Giriş hatası:', error);
        } else {
            window.location.href = 'dashboard.html';
        }
    });

});
