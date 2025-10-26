import { supabaseUrl, supabaseAnonKey } from './config.js';

// İsim çakışmasını önlemek için Supabase client'ını farklı bir isimle oluşturuyoruz.
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key) };
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, { 
    auth: { storage: authStorageAdapter } 
});

// Bu fonksiyon, bildirimleri sunucudan çeker ve arayüzü günceller.
async function fetchNotifications() {
    const notificationList = document.getElementById('notification-list');
    const notificationDot = document.getElementById('notification-dot');

    if (!notificationList || !notificationDot) {
        return;
    }

    // Aktif kullanıcıyı al
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Kullanıcıya ait okunmamış bildirimleri veritabanından çek
    const { data: notifications, error } = await supabaseClient
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

// notifications.js (oturumsuz)
function setupNotificationInteraction() {
  const bell = document.getElementById('notification-bell');
  const dropdown = document.getElementById('notification-dropdown');
  const dot = document.getElementById('notification-dot');
  const list = document.getElementById('notification-list');

  if (!bell || !dropdown) return;
  if (dot) dot.classList.add('hidden');
  if (list) list.innerHTML = '<p class="text-gray-500 text-sm text-center p-4">Bildirim özelliği devre dışı.</p>';

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => dropdown.classList.add('hidden'));
}
document.addEventListener('DOMContentLoaded', setupNotificationInteraction);
});
