import { supabaseUrl, supabaseAnonKey } from './config.js';

// Her sayfada kullanılacak genel bir Supabase client oluşturalım.
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Bu fonksiyon, bildirimleri sunucudan çeker ve arayüzü günceller.
async function fetchNotifications() {
    const notificationList = document.getElementById('notification-list');
    const notificationDot = document.getElementById('notification-dot');

    if (!notificationList || !notificationDot) {
        // Eğer sayfada bildirim elementleri yoksa (login sayfası gibi) işlemi durdur.
        return;
    }

    // Aktif kullanıcıyı al
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Kullanıcı giriş yapmamışsa devam etme

    // YENİ EKLENEN TEST KODU BURADA
    console.log("Uygulamanın Gördüğü Aktif Kullanıcı ID:", user.id);

    // Kullanıcıya ait okunmamış bildirimleri veritabanından çek (DÜZELTİLMİŞ HALİ)
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

    // Bildirim listesini temizle
    notificationList.innerHTML = ''; 

    if (notifications && notifications.length > 0) {
        notificationDot.classList.remove('hidden'); // Kırmızı noktayı göster

        notifications.forEach(notif => {
            const notifElement = document.createElement('a');
            notifElement.href = notif.link_url || '#';
            notifElement.className = 'block py-3 px-4 text-sm text-gray-700 hover:bg-gray-100 transition-colors';
            notifElement.textContent = notif.message;
            notificationList.appendChild(notifElement);
        });
    } else {
        notificationDot.classList.add('hidden'); // Kırmızı noktayı gizle
        notificationList.innerHTML = '<p class="text-gray-500 text-sm text-center p-4">Yeni bildirim yok.</p>';
    }
}

// Bu fonksiyon, bildirim menüsünün açma/kapama işlevselliğini yönetir.
function setupNotificationInteraction() {
    const notificationBell = document.getElementById('notification-bell');
    const notificationDropdown = document.getElementById('notification-dropdown');

    if (!notificationBell || !notificationDropdown) return;

    // Zile tıklandığında menüyü aç/kapat
    notificationBell.addEventListener('click', (e) => {
        e.stopPropagation(); // Olayın diğer elementlere yayılmasını engelle
        notificationDropdown.classList.toggle('hidden');
    });

    // Menünün kendisine tıklandığında kapanmasını engelle
    notificationDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Sayfanın herhangi bir yerine tıklandığında menüyü kapat
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
