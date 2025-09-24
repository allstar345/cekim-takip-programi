const SUPABASE_URL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elementleri
const kitapTabBtn = document.getElementById('kitap-tab-btn');
const videoTabBtn = document.getElementById('video-tab-btn');
const kitapTabContent = document.getElementById('kitap-tab-content');
const videoTabContent = document.getElementById('video-tab-content');
const kitapForm = document.getElementById('kitap-error-form');
const videoForm = document.getElementById('video-error-form');
const bookErrorTableBody = document.getElementById('book-error-table-body');
const videoErrorTableBody = document.getElementById('video-error-table-body');

// Sekme Değiştirme Fonksiyonları
const switchToKitapTab = () => {
    kitapTabContent.classList.remove('hidden');
    videoTabContent.classList.add('hidden');
    kitapTabBtn.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600';
    videoTabBtn.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
};

const switchToVideoTab = () => {
    videoTabContent.classList.remove('hidden');
    kitapTabContent.classList.add('hidden');
    videoTabBtn.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600';
    kitapTabBtn.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
};

kitapTabBtn.addEventListener('click', switchToKitapTab);
videoTabBtn.addEventListener('click', switchToVideoTab);

// Hataları Yükleme
async function loadErrors() {
    // Kitap Hataları
    const { data: bookErrors, error: bookError } = await db.from('kitap_hatalari').select('*').order('created_at', { ascending: false });
    if (bookError) console.error(bookError);
    else bookErrorTableBody.innerHTML = bookErrors.map(e => `<tr><td>${new Date(e.created_at).toLocaleDateString()}</td><td>${e.ogretmen_adi}</td><td>${e.ders_adi}</td><td>${e.kitap_adi}</td><td>${e.sayfa_numarasi}</td><td>${e.soru_numarasi}</td><td>${e.hata_aciklamasi}</td><td>${e.bildiren_kisi}</td></tr>`).join('');

    // Video Hataları
    const { data: videoErrors, error: videoError } = await db.from('video_hatalari').select('*').order('created_at', { ascending: false });
    if (videoError) console.error(videoError);
    else videoErrorTableBody.innerHTML = videoErrors.map(e => `<tr><td>${new Date(e.created_at).toLocaleDateString()}</td><td>${e.ogretmen_adi}</td><td>${e.ders_adi}</td><td>${e.hata_aciklamasi}</td><td>${e.bildiren_kisi}</td></tr>`).join('');
}

// Form Gönderme
kitapForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dataToInsert = {
        ogretmen_adi: document.getElementById('kitap_ogretmen_adi').value,
        ders_adi: document.getElementById('kitap_ders_adi').value,
        kitap_adi: document.getElementById('kitap_adi').value,
        sayfa_numarasi: document.getElementById('kitap_sayfa_numarasi').value,
        soru_numarasi: document.getElementById('kitap_soru_numarasi').value,
        hata_aciklamasi: document.getElementById('kitap_hata_aciklamasi').value,
        bildiren_kisi: document.getElementById('kitap_bildiren_kisi').value
    };
    const { error } = await db.from('kitap_hatalari').insert([dataToInsert]);
    if (error) { alert('Hata oluştu!'); console.error(error); }
    else { alert('Kitap hatası başarıyla bildirildi!'); kitapForm.reset(); loadErrors(); }
});

videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dataToInsert = {
        ogretmen_adi: document.getElementById('video_ogretmen_adi').value,
        ders_adi: document.getElementById('video_ders_adi').value,
        hata_aciklamasi: document.getElementById('video_hata_aciklamasi').value,
        bildiren_kisi: document.getElementById('video_bildiren_kisi').value
    };
    const { error } = await db.from('video_hatalari').insert([dataToInsert]);
    if (error) { alert('Hata oluştu!'); console.error(error); }
    else { alert('Video hatası başarıyla bildirildi!'); videoForm.reset(); loadErrors(); }
});

// Sayfa ilk yüklendiğinde hataları getir
document.addEventListener('DOMContentLoaded', loadErrors);
