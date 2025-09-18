document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';
    const { createClient } = supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const signupForm = document.getElementById('signup-form');
    const submitButton = document.getElementById('submit-button');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = signupForm.full_name.value;
        const email = signupForm.email.value;
        const password = signupForm.password.value;

        // Butonu devre dışı bırak ve metni değiştir
        submitButton.disabled = true;
        submitButton.textContent = 'İşleniyor...';

        const { data, error } = await db.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    // Yeni kaydolan kullanıcılara varsayılan olarak hiçbir yetki vermiyoruz.
                    // Yönetici onayından sonra yetkileri SQL ile eklenecek.
                    permissions: [] 
                }
            }
        });

        if (error) {
            Swal.fire({
                icon: 'error',
                title: 'Kayıt Hatası!',
                text: error.message, // Supabase'den gelen hatayı direkt göster
            });
        } else {
            Swal.fire({
                icon: 'success',
                title: 'Kayıt Başarılı!',
                text: 'Hesabınız oluşturuldu. Yöneticiniz onayladıktan sonra giriş yapabilirsiniz.',
                confirmButtonText: 'Tamam'
            }).then(() => {
                // Kullanıcıyı bilgilendirdikten sonra giriş sayfasına yönlendir
                window.location.href = 'login.html';
            });
        }

        // Butonu tekrar aktif et
        submitButton.disabled = false;
        submitButton.textContent = 'Kayıt Ol';
    });
});
