// =================================================================================
// MERKEZİ KONFİGÜRASYON DOSYASI
// =================================================================================
// Bu dosya, tüm uygulama tarafından kullanılacak olan Supabase istemci bilgilerini
// merkezi bir yerden sağlar. Anahtar değişikliği gerektiğinde sadece bu dosyanın
// güncellenmesi yeterlidir.
// =================================================================================

// Supabase projenizin URL'si
const supabaseUrl = 'https://vpxwjehzdbyekpfborbc.supabase.co';

// Supabase projenizin public anon anahtarı
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';

// Değişkenleri diğer dosyalarda kullanabilmek için dışa aktarıyoruz (export).
export { supabaseUrl, supabaseAnonKey };
