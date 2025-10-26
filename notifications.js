// notifications.js (temiz sürüm)
import { supabaseUrl, supabaseAnonKey } from './config.js';

const { createClient } = supabase;
const db = createClient(supabaseUrl, supabaseAnonKey);

// UI elemanları
const bell = document.getElementById('notification-bell');
const dot = document.getElementById('notification-dot');
const dropdown = document.getElementById('notification-dropdown');
const list = document.getElementById('notification-list');

let isOpen = false;

// Bildirimleri çek
async function loadNotifications() {
  if (!list) return;

  // örnek şema: notifications(id, message, created_at, read)
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Bildirimler alınamadı:', error);
    list.innerHTML = `<p class="text-red-500 p-4 text-sm">Bildirimler alınamadı.</p>`;
    dot?.classList.add('hidden');
    return;
  }

  const unreadCount = (data || []).filter(n => !n.read).length;
  if (unreadCount > 0) dot?.classList.remove('hidden'); else dot?.classList.add('hidden');

  if (!data || data.length === 0) {
    list.innerHTML = `<p class="text-gray-500 text-sm text-center p-4">Yeni bildirim yok.</p>`;
    return;
  }

  list.innerHTML = '';
  data.forEach(n => {
    const item = document.createElement('div');
    item.className = 'px-4 py-3 border-b hover:bg-gray-50';
    item.innerHTML = `
      <div class="text-sm text-gray-800">${n.message || '—'}</div>
      <div class="text-xs text-gray-400 mt-1">${new Date(n.created_at).toLocaleString('tr-TR')}</div>
    `;
    list.appendChild(item);
  });
}

// Aç/Kapat
function toggleDropdown(force) {
  if (!dropdown) return;
  isOpen = force ?? !isOpen;
  if (isOpen) {
    dropdown.classList.remove('hidden');
    loadNotifications();
  } else {
    dropdown.classList.add('hidden');
  }
}

// Dışarı tıklayınca kapat
document.addEventListener('click', (e) => {
  if (!dropdown || !bell) return;
  if (dropdown.contains(e.target) || bell.contains(e.target)) return;
  toggleDropdown(false);
});

// Zil tıklandı
bell?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDropdown();
});

// Realtime – bildirim tablosu değiştikçe listeyi güncelle
try {
  db.channel('public:notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
      if (isOpen) loadNotifications(); else dot?.classList.remove('hidden');
    })
    .subscribe();
} catch (err) {
  console.warn('Realtime bildirimi açılamadı:', err);
}

// İlk yükleme
loadNotifications();
