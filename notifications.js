import { supabaseUrl, supabaseAnonKey } from './config.js';

// --- DÜZELTME BURADA ---
// Supabase client'ını, kullanıcının oturumunu (session) doğru bulabilmesi için
// hem localStorage hem de sessionStorage'a bakacak şekilde yapılandırıyoruz.
const authStorageAdapter = { 
    getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
    setItem: (key, value) => { 
        // Bu dosya sadece okuma yaptığı için setItem ve removeItem'ın içi boş kalabilir
        // ama Supabase'in beklemesi nedeniyle tanımlı olmaları gerekir.
        try { localStorage.setItem(key, value); } catch (e) {}
    },
    removeItem: (key) => { 
        localStorage.removeItem(key); 
        sessionStorage.removeItem(key);
    }
};

const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey, { 
    auth: { storage: authStorageAdapter } 
});

// Bu fonksiyon, bildirimleri sunucudan çeker ve arayüzü günceller.
async function fetchNotifications() {
    const notificationList = document.getElementById('notification-list');
    const notificationDot = document.getElementById('notification-dot');

    if (!notificationList || !notificationDot) {
        return;
    }

    // Aktif kullanıcıyı al (Artık doğru şekilde bulacak)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Kullanıcıya ait okunmamış bildirimleri veritabanından çek
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('employee_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Bildirimler alınamadı:', error);
        notificationList.innerHTML = '<p class="text-red-500 text-sm text-center p-4">Bildirimler yüklenemedi.</p>';
        return;
    }

    notificationList.innerHTML = ''; 

    if (notifications && notifications.length > 0) {
        notificationDot.classList.remove('hidden'); 

        notifications.forEach(notif => {
            const notifElement = document.createElement('a');
            notifElement.href = notif.link_url || '#';
            notifElement.className = 'block py-3 px-4 text-sm text-gray-700 hover:bg-gray-100 transition-colors';
            notifElement.textContent = notif.message;
            notificationList.appendChild(notifElement);
        });
    } else {
        notificationDot.classList.add('hidden');
        notificationList.innerHTML = '<p class="text-gray-500 text-sm text-center p-4">Yeni bildirim yok.</p>';
    }
}

// Bu fonksiyon, bildirim menüsünün açma/kapama işlevselliğini yönetir.
function setupNotificationInteraction() {
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');

    if (!notificationBell || !notificationDropdown) return;

    notificationBell.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('hidden');
    });

    notificationDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', () => {
        if (!notificationDropdown.classList.contains('hidden')) {
            notificationDropdown.classList.add('hidden');
        }
    });
}

// Sayfa tamamen yüklendiğinde bu fonksiyonları çalıştır
document.addEventListener('DOMContentLoaded', () => {
    setupNotificationInteraction();
    fetchNotifications();
});
