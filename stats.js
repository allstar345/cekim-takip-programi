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
const DAYS_OF_WEEK_TIMESHEET = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
let allShootsData = [];
let teacherReportData = [];
let currentFilter = 'month';
let currentTimesheetDate = new Date();
const NORMAL_WORK_MINUTES = 450;


// --- Yardımcı Fonksiyonlar ---
function getThisWeekRange(date = new Date()) {
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

function getThisMonthRange() {
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
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}


// --- İstatistik ve Raporlama Fonksiyonları ---
function calculateAndRenderStats() {
    let filteredShoots = allShootsData;
    if (currentFilter === 'week') {
        const { start, end } = getThisWeekRange();
        filteredShoots = allShootsData.filter(s => s.date && new Date(s.date) >= start && new Date(s.date) <= end);
        subtitle.textContent = `Bu haftanın verileri gösterilmektedir.`;
    } else if (currentFilter === 'month') {
        const { start, end } = getThisMonthRange();
        filteredShoots = allShootsData.filter(s => s.date && new Date(s.date) >= start && new Date(s.date) <= end);
        subtitle.textContent = `Bu ayın verileri gösterilmektedir.`;
    } else {
         subtitle.textContent = `Tüm zamanlara ait veriler gösterilmektedir.`;
    }
    
    const teacherCounts = filteredShoots.reduce((acc, shoot) => {
        if (shoot.teacher) { acc[shoot.teacher] = (acc[shoot.teacher] || 0) + 1; }
        return acc;
    }, {});
    const directorCounts = filteredShoots.reduce((acc, shoot) => {
        if (shoot.director) { acc[shoot.director] = (acc[shoot.director] || 0) + 1; }
        return acc;
    }, {});

    let sortedTeachers = Object.entries(teacherCounts).sort((a, b) => b[1] - a[1]);
    let sortedDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]);
    
    if(teacherFilterInput.value) {
        sortedTeachers = sortedTeachers.filter(([name]) => name.toLowerCase().includes(teacherFilterInput.value.toLowerCase()));
    }
    if(directorFilterInput.value) {
        sortedDirectors = sortedDirectors.filter(([name]) => name.toLowerCase().includes(directorFilterInput.value.toLowerCase()));
    }

    teacherStatsBody.innerHTML = sortedTeachers.map(([name, count]) => `<tr><td class="px-6 py-4">${name}</td><td class="px-6 py-4">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç yok.</td></tr>';
    directorStatsBody.innerHTML = sortedDirectors.map(([name, count]) => `<tr><td class="px-6 py-4">${name}</td><td class="px-6 py-4">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç yok.</td></tr>';
    
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';
}

async function populateReportDropdowns() {
    const { data: teachers, error } = await db.from('teachers').select('name').order('name', { ascending: true });
    if (error) return;
    reportTeacherSelect.innerHTML += teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    reportFilterDirector.innerHTML += DIRECTORS_LIST.sort((a,b) => a.localeCompare(b)).map(d => `<option value="${d}">${d}</option>`).join('');
}

function renderTeacherReport(shootsToRender) {
    if (!shootsToRender || shootsToRender.length === 0) {
        teacherReportContainer.innerHTML = `<p class="text-gray-500">Bu kriterlere uygun çekim kaydı bulunamadı.</p>`;
        return;
    }
    let tableHTML = `
        <table id="teacher-report-table" class="min-w-full mt-4 text-sm border-collapse">
            <thead class="bg-gray-50">
                <tr><th>Tarih</th><th>Çekim Kodu</th><th>Çekim İçeriği</th><th>Yönetmen</th></tr>
            </thead>
            <tbody>
                ${shootsToRender.map(shoot => `
                    <tr>
                        <td>${new Date(shoot.date + 'T00:00:00').toLocaleDateString('tr-TR')}</td>
                        <td>${shoot.shoot_code || '-'}</td>
                        <td>${shoot.content || '-'}</td>
                        <td>${shoot.director || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    teacherReportContainer.innerHTML = tableHTML;
}

function applyReportFilters() {
    let filteredData = allShootsData;
    if (reportTeacherSelect.value) filteredData = filteredData.filter(s => s.teacher === reportTeacherSelect.value);
    if (reportFilterDate.value) filteredData = filteredData.filter(s => s.date === reportFilterDate.value);
    if (reportFilterDirector.value) filteredData = filteredData.filter(s => s.director === reportFilterDirector.value);
    if (reportGlobalSearch.value) {
        const searchText = reportGlobalSearch.value.toLowerCase();
        filteredData = filteredData.filter(s => 
            (s.shoot_code && s.shoot_code.toLowerCase().includes(searchText)) ||
            (s.content && s.content.toLowerCase().includes(searchText)) ||
            (s.director && s.director.toLowerCase().includes(searchText))
        );
    }
    renderTeacherReport(filteredData);
}

function setActiveButton(filter) {
     Object.values(filterButtons).forEach(btn => btn.classList.remove('active'));
     filterButtons[filter].classList.add('active');
     currentFilter = filter;
     calculateAndRenderStats();
}

// --- Mesai Tablosu Fonksiyonları ---
function updateTimesheetWeekDisplay() {
    const { start, end } = getThisWeekRange(currentTimesheetDate);
    weekRangeDisplayTimesheet.textContent = `${start.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit'})} - ${end.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
}

async function renderTimesheet() {
    updateTimesheetWeekDisplay();
    timesheetContainer.innerHTML = `<p class="text-gray-500">Mesai verileri yükleniyor...</p>`;

    const { start, end } = getThisWeekRange(currentTimesheetDate);
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    const weekIdentifier = getWeekIdentifier(start);

    const { data: shootsInWeek, error: shootsError } = await db.from('shoots').select('director').gte('date', startDateStr).lte('date', endDateStr);
    const { data: teamsInWeek, error: teamsError } = await db.from('daily_teams').select('team_members').eq('week_identifier', weekIdentifier);
    
    if(teamsError || shootsError) {
        console.error(teamsError || shootsError);
        timesheetContainer.innerHTML = `<p class="text-red-500">Çalışanlar çekilirken hata oluştu.</p>`;
        return;
    }

    const employeeSet = new Set();
    if (shootsInWeek) shootsInWeek.forEach(s => s.director && employeeSet.add(s.director));
    if (teamsInWeek) teamsInWeek.forEach(t => (t.team_members || []).forEach(m => employeeSet.add(m)));
    
    const employees = Array.from(employeeSet).sort((a, b) => a.localeCompare(b));

    if (employees.length === 0) {
        timesheetContainer.innerHTML = `<p class="text-gray-500">Bu hafta görevli çalışan bulunamadı.</p>`;
        return;
    }

    const { data: timesheetData } = await db.from('employee_timesheets').select('*').eq('week_identifier', weekIdentifier);
    const timesheetMap = new Map();
    if (timesheetData) {
        timesheetData.forEach(d => timesheetMap.set(`${d.employee_name}-${d.day_of_week}`, d));
    }

    let tableHTML = `
        <table id="timesheet-table" class="min-w-full text-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="w-1/6">Çalışan</th>
                    ${DAYS_OF_WEEK_TIMESHEET.map(day => `<th>${day}</th>`).join('')}
                    <th class="total-cell">Toplam Normal</th>
                    <th class="total-cell">Toplam Mesai</th>
                </tr>
            </thead>
            <tbody>
    `;

    employees.forEach(employee => {
        tableHTML += `<tr data-employee="${employee}"><td>${employee}</td>`;
        DAYS_OF_WEEK_TIMESHEET.forEach(day => {
            const entry = timesheetMap.get(`${employee}-${day}`);
            const startTime = entry && entry.start_time ? entry.start_time.substring(0, 5) : '';
            const endTime = entry && entry.end_time ? entry.end_time.substring(0, 5) : '';
            tableHTML += `
                <td>
                    <div class="flex space-x-1">
                        <input type="time" class="start-time" value="${startTime}" data-day="${day}">
                        <input type="time" class="end-time" value="${endTime}" data-day="${day}">
                    </div>
                </td>
            `;
        });
        tableHTML += `<td class="total-cell total-work">00:00</td><td class="total-cell total-overtime">00:00</td></tr>`;
    });

    tableHTML += `</tbody></table>`;
    timesheetContainer.innerHTML = tableHTML;
    calculateAllTotals();
}

function calculateAllTotals() {
    const rows = document.querySelectorAll('#timesheet-table tbody tr');
    rows.forEach(row => {
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
                    if (duration > 300) duration -= 60;
                    weeklyTotalMinutes += duration;
                }
            }
        }
        
        const normalWorkMinutes = Math.min(weeklyTotalMinutes, NORMAL_WORK_MINUTES * workDays);
        const overtimeMinutes = Math.max(0, weeklyTotalMinutes - (NORMAL_WORK_MINUTES * workDays));

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
        const inputs = row.querySelectorAll('input[type="time"]');
        for (let i = 0; i < inputs.length; i += 2) {
            const day = inputs[i].dataset.day;
            const startTime = inputs[i].value || null;
            const endTime = inputs[i+1].value || null;
            let duration = 0;
            if(startTime && endTime) {
                duration = HHMMToMinutes(endTime) - HHMMToMinutes(startTime);
            }

            dataToUpsert.push({
                week_identifier: weekIdentifier,
                employee_name: employeeName,
                day_of_week: day,
                start_time: startTime,
                end_time: endTime,
                total_duration_minutes: duration > 0 ? duration : 0
            });
        }
    });

    const { error } = await db.from('employee_timesheets').upsert(dataToUpsert, {
        onConflict: 'week_identifier, employee_name, day_of_week'
    });

    if (error) {
        console.error("Mesai kaydedilirken hata:", error);
        Swal.fire('Hata!', 'Mesai verileri kaydedilirken bir hata oluştu.', 'error');
    } else {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Mesai Tablosu Kaydedildi',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
    }

    saveTimesheetBtn.disabled = false;
    saveTimesheetBtn.textContent = 'Değişiklikleri Kaydet';
}

// --- Ana Yükleme ve Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // Önceki HTML'i dinamik olarak yükle
    mainStatsContainer.innerHTML = `
        <div class="bg-white rounded-2xl shadow-lg mb-8 p-6">
             <div class="flex flex-col md:flex-row md:justify-between md:items-start">
                <div>
                    <h2 class="text-lg font-bold text-gray-900">Zaman Aralığına Göre Filtrele</h2>
                    <p id="stats-subtitle" class="text-sm text-gray-500 mt-1">Veriler filtrelenmektedir...</p>
                </div>
                <div class="flex items-center space-x-2 mt-4 md:mt-0">
                    <button id="filter-week" class="filter-btn text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 py-2 px-4 rounded-lg transition-colors">Bu Hafta</button>
                    <button id="filter-month" class="filter-btn text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 py-2 px-4 rounded-lg transition-colors active">Bu Ay</button>
                    <button id="filter-all" class="filter-btn text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 py-2 px-4 rounded-lg transition-colors">Tüm Zamanlar</button>
                </div>
            </div>
        </div>
        <div id="stats-loading" class="text-center p-8 bg-white rounded-2xl shadow-lg">
            <p class="text-gray-500">İstatistikler hesaplanıyor, lütfen bekleyin...</p>
        </div>
        <div id="stats-content" class="hidden">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-white rounded-2xl shadow-lg p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">Öğretmen İstatistikleri</h2>
                    <input type="text" id="teacher-filter-input" placeholder="Öğretmen adıyla filtrele..." class="w-full px-3 py-2 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4">
                    <div class="overflow-y-auto max-h-96">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 sticky top-0"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Öğretmen</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Çekim Sayısı</th></tr></thead>
                            <tbody id="teacher-stats-body" class="bg-white divide-y divide-gray-200"></tbody>
                        </table>
                    </div>
                </div>
                <div class="bg-white rounded-2xl shadow-lg p-6">
                     <h2 class="text-xl font-bold text-gray-800 mb-4">Yönetmen İstatistikleri</h2>
                     <input type="text" id="director-filter-input" placeholder="Yönetmen adıyla filtrele..." class="w-full px-3 py-2 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4">
                    <div class="overflow-y-auto max-h-96">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 sticky top-0"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yönetmen</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Çekim Sayısı</th></tr></thead>
                            <tbody id="director-stats-body" class="bg-white divide-y divide-gray-200"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="mt-8 bg-white rounded-2xl shadow-lg p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Detaylı Çekim Dökümü</h2>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-end border-b pb-4 mb-4">
                    <div>
                        <label for="report-teacher-search" class="block text-sm font-medium text-gray-700 mb-2">Öğretmen Ara</label>
                        <input type="text" id="report-teacher-search" class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5" placeholder="Öğretmen adı...">
                    </div>
                    <div>
                        <label for="report-teacher-select" class="block text-sm font-medium text-gray-700 mb-2">Öğretmen Filtrele</label>
                        <select id="report-teacher-select" class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5"><option value="">Tümü</option></select>
                    </div>
                    <div>
                        <label for="report-filter-date" class="block text-sm font-medium text-gray-700 mb-2">Tarihe Göre</label>
                        <input type="date" id="report-filter-date" class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5">
                    </div>
                    <div>
                        <label for="report-filter-director" class="block text-sm font-medium text-gray-700 mb-2">Yönetmene Göre</label>
                         <select id="report-filter-director" class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5"><option value="">Tümü</option></select>
                    </div>
                    <div>
                        <label for="report-global-search" class="block text-sm font-medium text-gray-700 mb-2">Genel Arama</label>
                        <input type="text" id="report-global-search" class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5" placeholder="Kod, içerik, yönetmen ara...">
                    </div>
                </div>
                <div id="teacher-report-container" class="mt-4 overflow-x-auto"></div>
            </div>
        </div>
    `;

    // Elementleri yeniden ata
    loadingDiv = document.getElementById('stats-loading');
    contentDiv = document.getElementById('stats-content');
    teacherStatsBody = document.getElementById('teacher-stats-body');
    directorStatsBody = document.getElementById('director-stats-body');
    subtitle = document.getElementById('stats-subtitle');
    teacherFilterInput = document.getElementById('teacher-filter-input');
    directorFilterInput = document.getElementById('director-filter-input');
    reportTeacherSelect = document.getElementById('report-teacher-select');
    teacherReportContainer = document.getElementById('teacher-report-container');
    reportTeacherSearch = document.getElementById('report-teacher-search');
    reportFilterDate = document.getElementById('report-filter-date');
    reportFilterDirector = document.getElementById('report-filter-director');
    reportGlobalSearch = document.getElementById('report-global-search');
    filterButtons = {
        week: document.getElementById('filter-week'),
        month: document.getElementById('filter-month'),
        all: document.getElementById('filter-all'),
    };

    // Event listener'ları ata
    Object.keys(filterButtons).forEach(key => filterButtons[key].addEventListener('click', () => { setActiveButton(key); calculateAndRenderStats(); }));
    teacherFilterInput.addEventListener('input', calculateAndRenderStats);
    directorFilterInput.addEventListener('input', calculateAndRenderStats);
    reportTeacherSearch.addEventListener('input', () => {
        const searchText = reportTeacherSearch.value.toLowerCase();
        Array.from(reportTeacherSelect.options).forEach(option => {
            option.style.display = option.text.toLowerCase().includes(searchText) || option.value === '' ? '' : 'none';
        });
    });
    [reportTeacherSelect, reportFilterDate, reportFilterDirector, reportGlobalSearch].forEach(el => el.addEventListener('change', applyReportFilters));
    reportGlobalSearch.addEventListener('input', applyReportFilters);
    
    await populateReportDropdowns();
    applyReportFilters();
    
    const { data, error } = await db.from('shoots').select('*');
    if (error) {
        loadingDiv.innerHTML = `<p class="text-red-500">Veriler alınırken bir hata oluştu: ${error.message}</p>`;
    } else {
        allShootsData = data.filter(shoot => shoot.date && new Date(shoot.date) <= new Date());
        setActiveButton('month');
        calculateAndRenderStats();
    }
    
    renderTimesheet();
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
    const mainStorageAdapter = {
        getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
        setItem: (key, value) => { localStorage.setItem(key, value); sessionStorage.setItem(key, value); },
        removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); },
    };
    const supabase_logout = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH, {
        auth: { storage: mainStorageAdapter }
    });
    await supabase_logout.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});
