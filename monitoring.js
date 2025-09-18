//
// monitoring.html'in çalışması için gereken tüm JavaScript kodları buraya taşındı.
//

// --- Yetki Kontrolü ---
const SUPABASE_URL_AUTH = 'https://vpxwjehzdbyekpfborbc.supabase.co';
const SUPABASE_ANON_KEY_AUTH = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: ()=>{}, removeItem: ()=>{} };
const supabaseAuth = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH, { auth: { storage: authStorageAdapter } });

async function checkAuthAndPermissions() {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data: { user } } = await supabaseAuth.auth.getUser();
    const permissions = user?.user_metadata?.permissions || [];

    if (!permissions.includes('admin') && !permissions.includes('view_izleme')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}
checkAuthAndPermissions();


// --- Sayfa İşlevselliği ---
const db = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH);
const form = document.getElementById('monitoring-form');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const teacherSelect = document.getElementById('teacher_name');
const startTimeInput = document.getElementById('start_time');
const endTimeInput = document.getElementById('end_time');
const lunchSelect = document.getElementById('lunch_status');
const dinnerSelect = document.getElementById('dinner_status');
const durationDisplay = document.getElementById('total-duration');
const logsTableContainer = document.getElementById('logs-table-container');
const loadingDiv = document.getElementById('logs-loading');
const paginationContainer = document.getElementById('pagination-container');
const logoutBtn = document.getElementById('logout-btn');
const filterTeacherSelect = document.getElementById('filter-teacher');
const filterDateInput = document.getElementById('filter-date');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
let currentEditId = null;
let originalLogs = [];
let filteredLogs = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

async function populateTeacherDropdowns() {
    const { data: teachers, error } = await db.from('teachers').select('name').order('name', { ascending: true });
    
    if (error) {
        console.error('Öğretmen listesi veritabanından alınamadı:', error);
        return;
    }
    
    const teacherOptionsHTML = teachers.map(teacher => `<option value="${teacher.name}">${teacher.name}</option>`).join('');
    
    teacherSelect.innerHTML += teacherOptionsHTML;
    filterTeacherSelect.innerHTML += teacherOptionsHTML;
}

function calculateDurationAndBreaks() { const startTime = startTimeInput.value; const endTime = endTimeInput.value; const lunchTaken = lunchSelect.value === 'Çıktı'; const dinnerTaken = dinnerSelect.value === 'Çıktı'; if (!startTime || !endTime) { durationDisplay.textContent = '0 Saat 0 Dakika'; return "00:00"; } const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]); const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]); let totalMinutes = endMinutes - startMinutes; if (totalMinutes < 0) totalMinutes += 24 * 60; if (lunchTaken) totalMinutes -= 60; if (dinnerTaken) totalMinutes -= 30; if (totalMinutes < 0) totalMinutes = 0; const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60; durationDisplay.textContent = `${hours} Saat ${minutes} Dakika`; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; }
[startTimeInput, endTimeInput, lunchSelect, dinnerSelect].forEach(el => el.addEventListener('input', calculateDurationAndBreaks));
function applyFilters() { const selectedTeacher = filterTeacherSelect.value; const selectedDate = filterDateInput.value; filteredLogs = originalLogs.filter(log => { const teacherMatch = !selectedTeacher || log.teacher_name === selectedTeacher; const dateMatch = !selectedDate || log.date === selectedDate; return teacherMatch && dateMatch; }); renderTablePage(1); }
function clearFilters() { filterTeacherSelect.value = ''; filterDateInput.value = ''; applyFilters(); }
filterTeacherSelect.addEventListener('change', applyFilters);
filterDateInput.addEventListener('change', applyFilters);
clearFiltersBtn.addEventListener('click', clearFilters);
function renderTablePage(page = 1) { currentPage = page; logsTableContainer.innerHTML = ''; const start = (page - 1) * ITEMS_PER_PAGE; const end = start + ITEMS_PER_PAGE; if (start >= filteredLogs.length && filteredLogs.length > 0) { currentPage = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)); renderTablePage(currentPage); return; } const paginatedLogs = filteredLogs.slice(start, end); const table = document.createElement('table'); table.className = 'min-w-full'; table.style.borderCollapse = 'collapse'; table.innerHTML = `<thead class="bg-gray-50"><tr><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Tarih</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Öğretmen</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Giriş</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Çıkış</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Öğle Yemeği</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Akşam Yemeği</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">Toplam Süre</th><th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase" style="border: 1px solid #d1d5db;">İşlemler</th></tr></thead><tbody class="bg-white">${paginatedLogs.map(log => `<tr class="divide-x divide-gray-300"><td class="px-6 py-4 whitespace-nowrap text-sm text-center" style="border: 1px solid #d1d5db;">${new Date(log.date + 'T00:00:00').toLocaleDateString('tr-TR')}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-center" style="border: 1px solid #d1d5db;">${log.teacher_name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-center" style="border: 1px solid #d1d5db;">${log.start_time ? log.start_time.substring(0, 5) : ''}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-center" style="border: 1px solid #d1d5db;">${log.end_time ? log.end_time.substring(0, 5) : ''}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-center" style="border: 1px solid #d1d5db;">${log.lunch_status}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-center" style="border: 1px solid #d1d5db;">${log.dinner_status}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-center" style="border: 1px solid #d1d5db;">${log.total_duration}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-center" style="border: 1px solid #d1d5db;"><button data-id="${log.id}" class="edit-btn text-indigo-600 hover:text-indigo-900 mr-4">Düzenle</button><button data-id="${log.id}" class="delete-btn text-red-600 hover:text-red-900">Sil</button></td></tr>`).join('')}</tbody>`; logsTableContainer.appendChild(table); renderPagination(); }
function renderPagination() { const totalItems = filteredLogs.length; const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE); paginationContainer.innerHTML = ''; const summary = document.createElement('div'); summary.className = 'text-sm text-gray-700'; summary.textContent = `Toplam ${totalItems} kayıt bulundu.`; paginationContainer.appendChild(summary); if (totalPages <= 1) return; const buttonsDiv = document.createElement('div'); buttonsDiv.className = 'flex items-center'; const prevButton = document.createElement('button'); prevButton.innerHTML = '&laquo;'; prevButton.className = 'pagination-btn'; prevButton.disabled = currentPage === 1; prevButton.addEventListener('click', () => renderTablePage(currentPage - 1)); buttonsDiv.appendChild(prevButton); let pages = []; if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); } else { pages.push(1); if (currentPage > 4) pages.push('...'); let startPage = Math.max(2, currentPage - 2); let endPage = Math.min(totalPages - 1, currentPage + 2); for(let i = startPage; i <= endPage; i++) pages.push(i); if (currentPage < totalPages - 3) pages.push('...'); pages.push(totalPages); } pages = [...new Set(pages)]; pages.forEach(p => { const pageButton = document.createElement('button'); pageButton.textContent = p; if (p === '...') { pageButton.className = 'pagination-btn'; pageButton.disabled = true; } else { pageButton.className = `pagination-btn ${p === currentPage ? 'active' : ''}`; pageButton.addEventListener('click', () => renderTablePage(p)); } buttonsDiv.appendChild(pageButton); }); const nextButton = document.createElement('button'); nextButton.innerHTML = '&raquo;'; nextButton.className = 'pagination-btn'; nextButton.disabled = currentPage === totalPages; nextButton.addEventListener('click', () => renderTablePage(currentPage + 1)); buttonsDiv.appendChild(nextButton); paginationContainer.appendChild(buttonsDiv); }
async function fetchAndRenderLogs() { loadingDiv.style.display = 'block'; logsTableContainer.innerHTML = ''; paginationContainer.innerHTML = ''; const { data, error } = await db.from('monitoring_logs').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }); if (error) { logsTableContainer.innerHTML = `<p class="text-red-500">Veriler yüklenirken bir hata oluştu.</p>`; console.error(error); } else { originalLogs = data; if (originalLogs.length === 0) { logsTableContainer.innerHTML = `<p class="text-gray-500 text-center">Gösterilecek kayıt bulunmamaktadır.</p>`; } else { applyFilters(); } } loadingDiv.style.display = 'none'; }

// DEĞİŞİKLİK: Form gönderme fonksiyonu güncellendi
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const logData = Object.fromEntries(formData.entries());
    logData.total_duration = calculateDurationAndBreaks();
    
    let error;
    if (currentEditId) {
        ({ error } = await db.from('monitoring_logs').update(logData).eq('id', currentEditId));
    } else {
        ({ error } = await db.from('monitoring_logs').insert([logData]));
    }

    if (error) {
        console.error("Veri kaydetme hatası:", error);
        // Hata durumunda kullanıcıya güzel bir mesaj göster
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Kayıt eklenirken/güncellenirken bir hata oluştu. Lütfen tekrar deneyin.'
        });
    } else {
        // Başarı durumunda kullanıcıya güzel bir mesaj göster
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: currentEditId ? 'Kayıt Başarıyla Güncellendi' : 'Kayıt Başarıyla Eklendi',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        resetForm();
    }
});

function resetForm() { form.reset(); currentEditId = null; submitBtn.textContent = 'Kaydı Ekle'; cancelBtn.classList.add('hidden'); durationDisplay.textContent = '0 Saat 0 Dakika'; }
cancelBtn.addEventListener('click', resetForm);

// DEĞİŞİKLİK: Silme fonksiyonu, daha güzel bir onay kutusu kullanacak şekilde güncellendi
logsTableContainer.addEventListener('click', async (e) => {
    const target = e.target;
    const id = target.dataset.id;
    if (!id) return;

    if (target.classList.contains('delete-btn')) {
        Swal.fire({
            title: 'Emin misiniz?',
            text: "Bu kayıt kalıcı olarak silinecektir!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Evet, sil!',
            cancelButtonText: 'İptal'
        }).then(async (result) => {
            if (result.isConfirmed) {
                // Kullanıcı silmeyi onaylarsa veritabanından sil
                await db.from('monitoring_logs').delete().eq('id', id);
                // Not: Başarı mesajına gerek yok çünkü sayfa zaten anlık olarak güncellenip
                // silinen satırı listeden kaldıracaktır. Bu, en iyi geri bildirimdir.
            }
        });
    } else if (target.classList.contains('edit-btn')) {
        const logToEdit = originalLogs.find(log => log.id == id);
        if (logToEdit) {
            form.date.value = logToEdit.date;
            form.teacher_name.value = logToEdit.teacher_name;
            form.start_time.value = logToEdit.start_time;
            form.end_time.value = logToEdit.end_time;
            form.lunch_status.value = logToEdit.lunch_status;
            form.dinner_status.value = logToEdit.dinner_status;
            calculateDurationAndBreaks();
            currentEditId = id;
            submitBtn.textContent = 'Kaydı Güncelle';
            cancelBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    const mainStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: (key, value) => { localStorage.setItem(key, value); sessionStorage.setItem(key, value); }, removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); }, };
    const supabase_logout = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH, { auth: { storage: mainStorageAdapter } });
    await supabase_logout.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
    populateTeacherDropdowns();
    fetchAndRenderLogs();
});

db.channel('public:monitoring_logs').on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_logs' }, (payload) => { console.log('Değişiklik algılandı!', payload); fetchAndRenderLogs(); }).subscribe();
