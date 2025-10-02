import { supabaseUrl, supabaseAnonKey } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

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
        const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });
        const { data: { session } } = await tempSupabase.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
    })();

    // Form gönderildiğinde çalışacak kod
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = loginForm.username.value;
        const password = loginForm.password.value;
     
        errorMessage.classList.add('hidden');

        const storage = rememberMeCheckbox.checked ? localStorage : sessionStorage;
        const customStorageAdapter = {
            getItem: (key) => storage.getItem(key),
            setItem: (key, value) => storage.setItem(key, value),
            removeItem: (key) => storage.removeItem(key),
        };

        const db = createClient(supabaseUrl, supabaseAnonKey, {
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
