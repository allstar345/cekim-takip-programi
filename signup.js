import { supabaseUrl, supabaseAnonKey } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const { createClient } = supabase;
    const db = createClient(supabaseUrl, supabaseAnonKey);

    const signupForm = document.getElementById('signup-form');
    const submitButton = document.getElementById('submit-button');

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = signupForm.full_name.value;
        const email = signupForm.email.value;
        const password = signupForm.password.value;

        submitButton.disabled = true;
        submitButton.textContent = 'İşleniyor...';

        const { data, error } = await db.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    permissions: [] 
                }
            }
        });

        if (error) {
            Swal.fire({
                icon: 'error',
                title: 'Kayıt Hatası!',
                text: error.message,
            });
        } else {
            Swal.fire({
                icon: 'success',
                title: 'Kayıt Başarılı!',
                text: 'Hesabınız oluşturuldu. Yöneticiniz onayladıktan sonra giriş yapabilirsiniz.',
                confirmButtonText: 'Tamam'
            }).then(() => {
                window.location.href = 'login.html';
            });
        }

        submitButton.disabled = false;
        submitButton.textContent = 'Kayıt Ol';
    });
});
