import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Az önce oluşturduğumuz client dosyası
import './Notifications.css'; // Az önce oluşturduğumuz stil dosyası

// Basit bir Çan ikonu için SVG
const BellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 1. Başlangıçta bildirimleri çek
    fetchNotifications();

    // 2. Yeni bildirimler için Realtime dinleyiciyi başlat
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('Yeni bildirim geldi!', payload);
          // Yeni bildirimi listenin başına ekle ve sayacı artır
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    // 3. Component DOM'dan kaldırıldığında dinleyiciyi temizle
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20); // Son 20 bildirimi al

    if (error) {
      console.error('Bildirimleri çekerken hata:', error);
    } else {
      setNotifications(data);
      // Okunmamış bildirim sayısını hesapla
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    // Açıldığında, okunmamışları okundu olarak işaretle
    if (!isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  };
  
  const markAllAsRead = async () => {
      // Sadece okunmamış olanları güncelle
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if(unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if(error) {
          console.error("Bildirimleri okundu olarak işaretlerken hata:", error);
      } else {
          // Arayüzde de anında güncelle
          setNotifications(notifications.map(n => ({...n, is_read: true})));
          setUnreadCount(0);
      }
  };


  return (
    <div className="notification-container">
      <button onClick={handleToggle} className="notification-bell">
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <div key={notification.id} className={`notification-item ${!notification.is_read ? 'unread' : ''}`}>
                <p>{notification.message}</p>
                <small>{new Date(notification.created_at).toLocaleString('tr-TR')}</small>
              </div>
            ))
          ) : (
            <div className="notification-item">
              <p>Yeni bildirim yok.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
