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
    if (!permissions.includes('admin') && !permissions.includes('view_stats')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}
checkAuthAndPermissions();

// --- Sayfa İşlevselliği ---
const db = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH);

// --- DOM Elementleri ---
const logoutBtn = document.getElementById('logout-btn');
const mainStatsContainer = document.getElementById('main-stats-container');
let loadingDiv, contentDiv, teacherStatsBody, directorStatsBody, subtitle, teacherFilterInput, directorFilterInput, filterButtons;
let reportTeacherSelect, teacherReportContainer, reportTeacherSearch, reportFilterDate, reportFilterDirector, reportGlobalSearch;
const timesheetContainer = document.getElementById('timesheet-container');
const prevWeekTimesheetBtn = document.getElementById('prev-week-timesheet');
const nextWeekTimesheetBtn = document.getElementById('next-week-timesheet');
const weekRangeDisplayTimesheet = document.getElementById('week-range-display-timesheet');
const saveTimesheetBtn = document.getElementById('save-timesheet-btn');

// --- Sabit Listeler ve Değişkenler ---
const DIRECTORS_LIST = ["Anıl Kolay", "Batuhan Gültekin", "Merve Çoklar", "Nurdan Özveren", "Gözde Bulut", "Ali Yıldırım", "Raşit Güngör"];
const DAYS_OF_WEEK_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const DAYS_OF_WEEK_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let allShootsData = [];
let currentFilter = 'month';
let currentTimesheetDate = new Date();
const NORMAL_WORK_MINUTES = 450; // 7.5 saat

// --- Yardımcı Fonksiyonlar ---
function getWeekRange(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function getMonthRange() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    start.setHours(0,0,0,0);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function getWeekIdentifier(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function HHMMToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

function minutesToHHMM(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes < 0) totalMinutes = 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// --- İstatistik ve Raporlama Fonksiyonları (Değişiklik yok) ---
// ... (Bu bölümün önceki kodla aynı olduğunu varsayıyoruz, o yüzden buraya eklemiyorum)
async function renderMainStatsAndReport() {
    // Bu fonksiyon, sayfanın üst kısmındaki istatistik ve raporlama bölümünü yönetir.
    // Önceki kodunuzdan buraya kopyalanacak.
}


// --- YENİ VE GÜNCELLENMİŞ MESAİ TABLOSU FONKSİYONLARI ---

function updateTimesheetWeekDisplay() {
    const { start, end } = getWeekRange(currentTimesheetDate);
    weekRangeDisplayTimesheet.textContent = `${start.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit'})} - ${end.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
}

async function renderTimesheet() {
    updateTimesheetWeekDisplay();
    timesheetContainer.innerHTML = `<p class="text-gray-500 text-center py-8">Mesai verileri yükleniyor...</p>`;

    const { start, end } = getWeekRange(currentTimesheetDate);
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    const weekIdentifier = getWeekIdentifier(start);

    // 1. O hafta görevli tüm çalışanları çek (hem yönetmen hem teknik ekipten)
    const { data: shootsInWeek, error: shootsError } = await db.from('shoots')
        .select('date, director, start_time, end_time')
        .gte('date', startDateStr)
        .lte('date', endDateStr);
    
    const { data: teamsInWeek, error: teamsError } = await db.from('daily_teams')
        .select('team_members')
        .eq('week_identifier', weekIdentifier);

    if (shootsError || teamsError) {
        timesheetContainer.innerHTML = `<p class="text-red-500 text-center py-8">Hata: Çalışan verileri alınamadı.</p>`;
        return;
    }

    // 2. Çalışan listesini ve otomatik saatlerini hazırla
    const employeeSet = new Set();
    const autoTimes = {}; // Otomatik gelen saatleri tutacak nesne

    if (shootsInWeek) {
        shootsInWeek.forEach(s => {
            if (s.director) employeeSet.add(s.director);
            if (s.start_time && s.end_time) {
                const key = `${s.director}-${s.date}`;
                if (!autoTimes[key]) {
                    autoTimes[key] = { start: s.start_time, end: s.end_time };
                } else {
                    // Aynı gün birden fazla çekim varsa en erken başlangıç ve en geç bitişi al
                    if (s.start_time < autoTimes[key].start) autoTimes[key].start = s.start_time;
                    if (s.end_time > autoTimes[key].end) autoTimes[key].end = s.end_time;
                }
            }
        });
    }
    if (teamsInWeek) {
        teamsInWeek.forEach(t => (t.team_members || []).forEach(m => employeeSet.add(m)));
    }
    
    const employees = Array.from(employeeSet).sort((a, b) => a.localeCompare(b));

    if (employees.length === 0) {
        timesheetContainer.innerHTML = `<p class="text-gray-500 text-center py-8">Bu hafta için görevli çalışan bulunamadı.</p>`;
        return;
    }

    // 3. Kaydedilmiş manuel mesai verilerini çek
    const { data: savedTimesheetData } = await db.from('employee_timesheets')
        .select('*').eq('week_identifier', weekIdentifier);
    
    const savedTimesheetMap = new Map();
    if (savedTimesheetData) {
        savedTimesheetData.forEach(d => savedTimesheetMap.set(`${d.employee_name}-${d.day_of_week}`, d));
    }

    // 4. Tabloyu oluştur
    let tableHTML = `<table id="timesheet-table" class="min-w-full text-sm">
        <thead class="bg-gray-50"><tr>
            <th class="sticky left-0 bg-gray-50 z-10 w-48">Çalışan</th>
            ${DAYS_OF_WEEK_TR.map(day => `<th>${day}</th>`).join('')}
            <th class="total-cell">Toplam Normal</th><th class="total-cell">Toplam Mesai</th>
        </tr></thead><tbody>`;

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }

    employees.forEach(employee => {
        tableHTML += `<tr data-employee="${employee}"><td class="sticky left-0 bg-white font-medium text-gray-800 z-10">${employee}</td>`;
        
        DAYS_OF_WEEK_TR.forEach((day, index) => {
            const dateStr = weekDates[index];
            const savedEntry = savedTimesheetMap.get(`${employee}-${day}`);
            const autoEntry = autoTimes[`${employee}-${dateStr}`];

            // Öncelik: Kayıtlı manuel veri. Yoksa, otomatik veri. O da yoksa boş.
            const startTime = savedEntry?.start_time?.substring(0, 5) ?? autoEntry?.start?.substring(0, 5) ?? '';
            const endTime = savedEntry?.end_time?.substring(0, 5) ?? autoEntry?.end?.substring(0, 5) ?? '';

            tableHTML += `<td>
                <div class="flex space-x-1">
                    <input type="time" class="start-time w-full" value="${startTime}" data-day="${day}">
                    <input type="time" class="end-time w-full" value="${endTime}" data-day="${day}">
                </div>
            </td>`;
        });
        tableHTML += `<td class="total-cell total-work">00:00</td><td class="total-cell total-overtime">00:00</td></tr>`;
    });

    tableHTML += `</tbody></table>`;
    timesheetContainer.innerHTML = tableHTML;
    calculateAllTotals();
}

function calculateAllTotals() {
    document.querySelectorAll('#timesheet-table tbody tr').forEach(row => {
        let weeklyTotalMinutes = 0;
        let workDays = 0;
        const inputs = row.querySelectorAll('input[type="time"]');
        
        for (let i = 0; i < inputs.length; i += 2) {
            const start = inputs[i].value;
            const end = inputs[i+1].value;
            if (start && end) {
                let duration = HHMMToMinutes(end) - HHMMToMinutes(start);
                if (duration > 0) {
                    workDays++;
                    // 5 saati (300 dk) geçen çalışmalardan 1 saat mola düş
                    if (duration > 300) duration -= 60;
                    weeklyTotalMinutes += duration;
                }
            }
        }
        
        // Haftalık toplam çalışma süresini günlük 7.5 saat üzerinden hesapla
        const weeklyNormalLimit = NORMAL_WORK_MINUTES * workDays;
        const normalWorkMinutes = Math.min(weeklyTotalMinutes, weeklyNormalLimit);
        const overtimeMinutes = Math.max(0, weeklyTotalMinutes - weeklyNormalLimit);

        row.querySelector('.total-work').textContent = minutesToHHMM(normalWorkMinutes);
        row.querySelector('.total-overtime').textContent = minutesToHHMM(overtimeMinutes);
    });
}

async function saveTimesheet() {
    saveTimesheetBtn.disabled = true;
    saveTimesheetBtn.textContent = 'Kaydediliyor...';
    
    const rows = document.querySelectorAll('#timesheet-table tbody tr');
    const weekIdentifier = getWeekIdentifier(currentTimesheetDate);
    const dataToUpsert = [];

    rows.forEach(row => {
        const employeeName = row.dataset.employee;
        row.querySelectorAll('input.start-time').forEach(startInput => {
            const day = startInput.dataset.day;
            const endInput = row.querySelector(`input.end-time[data-day="${day}"]`);
            const startTime = startInput.value || null;
            const endTime = endInput.value || null;

            dataToUpsert.push({
                week_identifier: weekIdentifier,
                employee_name: employeeName,
                day_of_week: day,
                start_time: startTime,
                end_time: endTime,
            });
        });
    });

    const { error } = await db.from('employee_timesheets').upsert(dataToUpsert, {
        onConflict: 'week_identifier, employee_name, day_of_week'
    });

    if (error) {
        console.error("Mesai kaydedilirken hata:", error);
        Swal.fire('Hata!', 'Mesai verileri kaydedilirken bir hata oluştu: ' + error.message, 'error');
    } else {
        Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Mesai Tablosu Kaydedildi',
            showConfirmButton: false, timer: 2000, timerProgressBar: true
        });
    }

    saveTimesheetBtn.disabled = false;
    saveTimesheetBtn.textContent = 'Değişiklikleri Kaydet';
}

// --- Ana Yükleme ve Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // Önceki istatistik ve raporlama bölümünü yükle
    // Bu kısmı önceki koddan alıp buraya ekleyebilirsiniz veya fonksiyonu çağırabilirsiniz.
    // renderMainStatsAndReport(); 
    
    // Mesai tablosunu yükle
    await renderTimesheet();
});

prevWeekTimesheetBtn.addEventListener('click', () => {
    currentTimesheetDate.setDate(currentTimesheetDate.getDate() - 7);
    renderTimesheet();
});

nextWeekTimesheetBtn.addEventListener('click', () => {
    currentTimesheetDate.setDate(currentTimesheetDate.getDate() + 7);
    renderTimesheet();
});

saveTimesheetBtn.addEventListener('click', saveTimesheet);

timesheetContainer.addEventListener('input', (e) => {
    if (e.target.matches('input[type="time"]')) {
        calculateAllTotals();
    }
});

logoutBtn.addEventListener('click', async () => {
    // ... Logout kodu ...
    await supabaseAuth.auth.signOut();
    window.location.href = 'login.html';
});

// NOT: Yukarıdaki kodda istatistik ve raporlama fonksiyonlarını yer kaplamaması adına çıkardım.
// Lütfen bu yeni kodu, eski stats.js'teki mesai fonksiyonlarının yerine koyarak birleştirin.
// Veya en kolayı, eski stats.js'in tamamını silip bu kodu yapıştırın ve
// eski koddan sadece istatistik/raporlama ile ilgili fonksiyonları (calculateAndRenderStats, populateReportDropdowns vb.)
// bu kodun ilgili bölümüne ekleyin.
// Ben sizin için tam birleştirilmiş halini aşağıya bırakıyorum.

/* //==============================================================
// KOPYALANACAK TAM KOD AŞAĞIDADIR
// YUKARIDAKİ AÇIKLAMAYDI, LÜTFEN AŞAĞIDAKİ KODUN TAMAMINI KULLANIN
//==============================================================
*/
// YUKARIDAKİ KODU SİLİP BUNU KULLANIN
const SUPABASE_URL_AUTH_FULL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
const SUPABASE_ANON_KEY_AUTH_FULL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';
const authStorageAdapter_full = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: ()=>{}, removeItem: ()=>{} };
const supabaseAuth_full = supabase.createClient(SUPABASE_URL_AUTH_FULL, SUPABASE_ANON_KEY_AUTH_FULL, { auth: { storage: authStorageAdapter_full } });

async function checkAuthAndPermissions_full() {
    const { data: { session } } = await supabaseAuth_full.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    const { data: { user } } = await supabaseAuth_full.auth.getUser();
    const permissions = user?.user_metadata?.permissions || [];
    if (!permissions.includes('admin') && !permissions.includes('view_stats')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}
checkAuthAndPermissions_full();

const db_full = supabase.createClient(SUPABASE_URL_AUTH_FULL, SUPABASE_ANON_KEY_AUTH_FULL);

// --- DOM Elementleri ---
const logoutBtn_full = document.getElementById('logout-btn');
const loadingDiv_full = document.getElementById('stats-loading');
const contentDiv_full = document.getElementById('stats-content');
const teacherStatsBody_full = document.getElementById('teacher-stats-body');
const directorStatsBody_full = document.getElementById('director-stats-body');
const subtitle_full = document.getElementById('stats-subtitle');
const teacherFilterInput_full = document.getElementById('teacher-filter-input');
const directorFilterInput_full = document.getElementById('director-filter-input');
const reportTeacherSelect_full = document.getElementById('report-teacher-select');
const teacherReportContainer_full = document.getElementById('teacher-report-container');
const reportTeacherSearch_full = document.getElementById('report-teacher-search');
const reportFilterDate_full = document.getElementById('report-filter-date');
const reportFilterDirector_full = document.getElementById('report-filter-director');
const reportGlobalSearch_full = document.getElementById('report-global-search');
const timesheetContainer_full = document.getElementById('timesheet-container');
const prevWeekTimesheetBtn_full = document.getElementById('prev-week-timesheet');
const nextWeekTimesheetBtn_full = document.getElementById('next-week-timesheet');
const weekRangeDisplayTimesheet_full = document.getElementById('week-range-display-timesheet');
const saveTimesheetBtn_full = document.getElementById('save-timesheet-btn');
const filterButtons_full = {
    week: document.getElementById('filter-week'),
    month: document.getElementById('filter-month'),
    all: document.getElementById('filter-all'),
};

// --- Değişkenler ---
let allShootsData_full = [];
let currentFilter_full = 'month';
let currentTimesheetDate_full = new Date();
const NORMAL_WORK_MINUTES_FULL = 450; // 7.5 saat

// --- Yardımcı Fonksiyonlar ---
function getWeekRange_full(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
function getMonthRange_full() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
function getWeekIdentifier_full(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}
function HHMMToMinutes_full(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}
function minutesToHHMM_full(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes < 0) totalMinutes = 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// --- İstatistik ve Raporlama Fonksiyonları ---
function calculateAndRenderStats_full() {
    loadingDiv_full.style.display = 'block';
    contentDiv_full.style.display = 'none';

    let filteredShoots = allShootsData_full;
    if (currentFilter_full === 'week') {
        const { start, end } = getWeekRange_full();
        filteredShoots = allShootsData_full.filter(s => s.date && new Date(s.date) >= start && new Date(s.date) <= end);
        subtitle_full.textContent = `Bu haftanın verileri gösterilmektedir.`;
    } else if (currentFilter_full === 'month') {
        const { start, end } = getMonthRange_full();
        filteredShoots = allShootsData_full.filter(s => s.date && new Date(s.date) >= start && new Date(s.date) <= end);
        subtitle_full.textContent = `Bu ayın verileri gösterilmektedir.`;
    } else {
        subtitle_full.textContent = `Tüm zamanlara ait veriler gösterilmektedir.`;
    }

    const teacherCounts = filteredShoots.reduce((acc, shoot) => { if (shoot.teacher) { acc[shoot.teacher] = (acc[shoot.teacher] || 0) + 1; } return acc; }, {});
    const directorCounts = filteredShoots.reduce((acc, shoot) => { if (shoot.director) { acc[shoot.director] = (acc[shoot.director] || 0) + 1; } return acc; }, {});

    let sortedTeachers = Object.entries(teacherCounts).sort((a, b) => b[1] - a[1]);
    if(teacherFilterInput_full.value) sortedTeachers = sortedTeachers.filter(([name]) => name.toLowerCase().includes(teacherFilterInput_full.value.toLowerCase()));
    teacherStatsBody_full.innerHTML = sortedTeachers.map(([name, count]) => `<tr><td class="px-6 py-4">${name}</td><td class="px-6 py-4">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç yok.</td></tr>';

    let sortedDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]);
    if(directorFilterInput_full.value) sortedDirectors = sortedDirectors.filter(([name]) => name.toLowerCase().includes(directorFilterInput_full.value.toLowerCase()));
    directorStatsBody_full.innerHTML = sortedDirectors.map(([name, count]) => `<tr><td class="px-6 py-4">${name}</td><td class="px-6 py-4">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç yok.</td></tr>';

    loadingDiv_full.style.display = 'none';
    contentDiv_full.style.display = 'block';
}

function applyReportFilters_full() {
    let filteredData = allShootsData_full;
    if (reportTeacherSelect_full.value) filteredData = filteredData.filter(s => s.teacher === reportTeacherSelect_full.value);
    if (reportFilterDate_full.value) filteredData = filteredData.filter(s => s.date === reportFilterDate_full.value);
    if (reportFilterDirector_full.value) filteredData = filteredData.filter(s => s.director === reportFilterDirector_full.value);
    if (reportGlobalSearch_full.value) {
        const searchText = reportGlobalSearch_full.value.toLowerCase();
        filteredData = filteredData.filter(s =>
            (s.shoot_code && s.shoot_code.toLowerCase().includes(searchText)) ||
            (s.content && s.content.toLowerCase().includes(searchText)) ||
            (s.director && s.director.toLowerCase().includes(searchText))
        );
    }
    renderTeacherReport_full(filteredData);
}

function renderTeacherReport_full(shootsToRender) {
    if (!shootsToRender || shootsToRender.length === 0) {
        teacherReportContainer_full.innerHTML = `<p class="text-gray-500">Bu kriterlere uygun çekim kaydı bulunamadı.</p>`;
        return;
    }
    let tableHTML = `<table id="teacher-report-table" class="min-w-full mt-4 text-sm border-collapse"><thead class="bg-gray-50"><tr><th>Tarih</th><th>Öğretmen</th><th>Çekim Kodu</th><th>Çekim İçeriği</th><th>Yönetmen</th></tr></thead><tbody>
        ${shootsToRender.sort((a, b) => new Date(b.date) - new Date(a.date)).map(shoot => `
            <tr><td>${new Date(shoot.date + 'T00:00:00').toLocaleDateString('tr-TR')}</td><td>${shoot.teacher || '-'}</td><td>${shoot.shoot_code || '-'}</td><td>${shoot.content || '-'}</td><td>${shoot.director || '-'}</td></tr>
        `).join('')}
    </tbody></table>`;
    teacherReportContainer_full.innerHTML = tableHTML;
}

async function populateReportDropdowns_full() {
    const { data: teachers, error } = await db_full.from('teachers').select('name').order('name', { ascending: true });
    if (error) return;
    const { data: shoots, error: shootsError } = await db_full.from('shoots').select('director');
    if(shootsError) return;
    
    const directors = [...new Set(shoots.map(s => s.director).filter(Boolean))].sort();
    
    reportTeacherSelect_full.innerHTML += teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    reportFilterDirector_full.innerHTML += directors.map(d => `<option value="${d}">${d}</option>`).join('');
}

function setActiveButton_full(filter) {
    Object.values(filterButtons_full).forEach(btn => btn.classList.remove('active'));
    filterButtons_full[filter].classList.add('active');
    currentFilter_full = filter;
    calculateAndRenderStats_full();
}

// --- Mesai Tablosu Fonksiyonları ---
function updateTimesheetWeekDisplay_full() {
    const { start, end } = getWeekRange_full(currentTimesheetDate_full);
    weekRangeDisplayTimesheet_full.textContent = `${start.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit'})} - ${end.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
}

async function renderTimesheet_full() {
    updateTimesheetWeekDisplay_full();
    timesheetContainer_full.innerHTML = `<p class="text-gray-500 text-center py-8">Mesai verileri yükleniyor...</p>`;

    const { start, end } = getWeekRange_full(currentTimesheetDate_full);
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    const weekIdentifier = getWeekIdentifier_full(start);

    const { data: shootsInWeek, error: shootsError } = await db_full.from('shoots').select('date, director, start_time, end_time').gte('date', startDateStr).lte('date', endDateStr);
    const { data: teamsInWeek, error: teamsError } = await db_full.from('daily_teams').select('team_members').eq('week_identifier', weekIdentifier);

    if (shootsError || teamsError) {
        timesheetContainer_full.innerHTML = `<p class="text-red-500 text-center py-8">Hata: Çalışan verileri alınamadı.</p>`;
        return;
    }

    const employeeSet = new Set();
    const autoTimes = {};
    if (shootsInWeek) {
        shootsInWeek.forEach(s => {
            if (s.director) employeeSet.add(s.director);
            if (s.start_time && s.end_time) {
                const key = `${s.director}-${s.date}`;
                if (!autoTimes[key]) autoTimes[key] = { start: s.start_time, end: s.end_time };
                else {
                    if (s.start_time < autoTimes[key].start) autoTimes[key].start = s.start_time;
                    if (s.end_time > autoTimes[key].end) autoTimes[key].end = s.end_time;
                }
            }
        });
    }
    if (teamsInWeek) teamsInWeek.forEach(t => (t.team_members || []).forEach(m => employeeSet.add(m)));
    const employees = Array.from(employeeSet).sort((a, b) => a.localeCompare(b));

    if (employees.length === 0) {
        timesheetContainer_full.innerHTML = `<p class="text-gray-500 text-center py-8">Bu hafta için görevli çalışan bulunamadı.</p>`;
        return;
    }

    const { data: savedTimesheetData } = await db_full.from('employee_timesheets').select('*').eq('week_identifier', weekIdentifier);
    const savedTimesheetMap = new Map(savedTimesheetData?.map(d => [`${d.employee_name}-${d.day_of_week}`, d]));

    let tableHTML = `<table id="timesheet-table" class="min-w-full text-sm"><thead class="bg-gray-50"><tr><th class="sticky left-0 bg-gray-50 z-10 w-48">Çalışan</th>${["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].map(day => `<th>${day}</th>`).join('')}<th class="total-cell">Toplam Normal</th><th class="total-cell">Toplam Mesai</th></tr></thead><tbody>`;
    const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().split('T')[0]; });

    employees.forEach(employee => {
        tableHTML += `<tr data-employee="${employee}"><td class="sticky left-0 bg-white font-medium text-gray-800 z-10">${employee}</td>`;
        ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].forEach((day, index) => {
            const dateStr = weekDates[index];
            const savedEntry = savedTimesheetMap.get(`${employee}-${day}`);
            const autoEntry = autoTimes[`${employee}-${dateStr}`];
            const startTime = savedEntry?.start_time?.substring(0, 5) ?? autoEntry?.start?.substring(0, 5) ?? '';
            const endTime = savedEntry?.end_time?.substring(0, 5) ?? autoEntry?.end?.substring(0, 5) ?? '';
            tableHTML += `<td><div class="flex space-x-1"><input type="time" class="start-time w-full" value="${startTime}" data-day="${day}"><input type="time" class="end-time w-full" value="${endTime}" data-day="${day}"></div></td>`;
        });
        tableHTML += `<td class="total-cell total-work">00:00</td><td class="total-cell total-overtime">00:00</td></tr>`;
    });

    timesheetContainer_full.innerHTML = `${tableHTML}</tbody></table>`;
    calculateAllTotals_full();
}

function calculateAllTotals_full() {
    document.querySelectorAll('#timesheet-table tbody tr').forEach(row => {
        let weeklyTotalMinutes = 0, workDays = 0;
        for (let i = 0; i < row.cells.length - 3; i++) {
            const start = row.cells[i+1].querySelector('.start-time').value;
            const end = row.cells[i+1].querySelector('.end-time').value;
            if (start && end) {
                let duration = HHMMToMinutes_full(end) - HHMMToMinutes_full(start);
                if (duration > 0) {
                    workDays++;
                    if (duration > 300) duration -= 60; // Mola
                    weeklyTotalMinutes += duration;
                }
            }
        }
        const weeklyNormalLimit = NORMAL_WORK_MINUTES_FULL * workDays;
        const normalWorkMinutes = Math.min(weeklyTotalMinutes, weeklyNormalLimit);
        const overtimeMinutes = Math.max(0, weeklyTotalMinutes - weeklyNormalLimit);
        row.querySelector('.total-work').textContent = minutesToHHMM_full(normalWorkMinutes);
        row.querySelector('.total-overtime').textContent = minutesToHHMM_full(overtimeMinutes);
    });
}

async function saveTimesheet_full() {
    saveTimesheetBtn_full.disabled = true;
    saveTimesheetBtn_full.textContent = 'Kaydediliyor...';
    const weekIdentifier = getWeekIdentifier_full(currentTimesheetDate_full);
    const dataToUpsert = [];
    document.querySelectorAll('#timesheet-table tbody tr').forEach(row => {
        const employeeName = row.dataset.employee;
        row.querySelectorAll('input.start-time').forEach(startInput => {
            const day = startInput.dataset.day;
            const endInput = row.querySelector(`input.end-time[data-day="${day}"]`);
            dataToUpsert.push({
                week_identifier: weekIdentifier, employee_name: employeeName, day_of_week: day,
                start_time: startInput.value || null, end_time: endInput.value || null,
            });
        });
    });

    const { error } = await db_full.from('employee_timesheets').upsert(dataToUpsert, { onConflict: 'week_identifier, employee_name, day_of_week' });
    if (error) Swal.fire('Hata!', `Mesai kaydedilemedi: ${error.message}`, 'error');
    else Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Mesai Tablosu Kaydedildi', showConfirmButton: false, timer: 2000 });
    saveTimesheetBtn_full.disabled = false;
    saveTimesheetBtn_full.textContent = 'Değişiklikleri Kaydet';
}

// --- Ana Yükleme ve Olay Dinleyiciler ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data, error } = await db_full.from('shoots').select('*');
    if (error) {
        loadingDiv_full.innerHTML = `<p class="text-red-500">Veriler alınırken bir hata oluştu: ${error.message}</p>`;
    } else {
        allShootsData_full = data.filter(shoot => shoot.date && new Date(shoot.date) <= new Date());
        await populateReportDropdowns_full();
        setActiveButton_full('month');
        applyReportFilters_full();
    }
    await renderTimesheet_full();
});

Object.keys(filterButtons_full).forEach(key => filterButtons_full[key].addEventListener('click', () => setActiveButton_full(key)));
teacherFilterInput_full.addEventListener('input', calculateAndRenderStats_full);
directorFilterInput_full.addEventListener('input', calculateAndRenderStats_full);
[reportTeacherSelect_full, reportFilterDate_full, reportFilterDirector_full].forEach(el => el.addEventListener('change', applyReportFilters_full));
reportGlobalSearch_full.addEventListener('input', applyReportFilters_full);
reportTeacherSearch_full.addEventListener('input', () => {
    const searchText = reportTeacherSearch_full.value.toLowerCase();
    Array.from(reportTeacherSelect_full.options).forEach(option => {
        option.style.display = option.text.toLowerCase().includes(searchText) || option.value === '' ? '' : 'none';
    });
});
prevWeekTimesheetBtn_full.addEventListener('click', () => { currentTimesheetDate_full.setDate(currentTimesheetDate_full.getDate() - 7); renderTimesheet_full(); });
nextWeekTimesheetBtn_full.addEventListener('click', () => { currentTimesheetDate_full.setDate(currentTimesheetDate_full.getDate() + 7); renderTimesheet_full(); });
saveTimesheetBtn_full.addEventListener('click', saveTimesheet_full);
timesheetContainer_full.addEventListener('input', (e) => { if (e.target.matches('input[type="time"]')) calculateAllTotals_full(); });
logoutBtn_full.addEventListener('click', async () => { await supabaseAuth_full.auth.signOut(); window.location.href = 'login.html'; });
