const SUPABASE_URL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';

// Uygulama genelinde kullanılacak tek Supabase istemcisi
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Tüm kullanıcıların yetkilerini tek bir yerden yönetiyoruz
const PERMISSIONS_MAP = {
    'fatih@sistem.local': ['admin'],
    'enesyardim@sistem.local': ['admin'],
    'reji@sistem.local': ['view_cekim'],
    'gorseltasarim@sistem.local': ['view_cekim', 'view_stats'],
    'akademikizleme@sistem.local': ['view_izleme'],
    'koordinator@sistem.local': ['view_cekim', 'view_stats']
};
