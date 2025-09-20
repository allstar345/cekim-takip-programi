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
const NORMAL_WORK_MINUTES = 450; // 7.5 saat * 60 dakika

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
    // ... Bu fonksiyonun içeriği aynı kalacak (önceki versiyondan alınabilir)
}
async function populateReportDropdowns() {
    // ... Bu fonksiyonun içeriği aynı kalacak (önceki versiyondan alınabilir)
}
function renderTeacherReport(shootsToRender) {
    // ... Bu fonksiyonun içeriği aynı kalacak (önceki versiyondan alınabilir)
}
function applyReportFilters() {
    // ... Bu fonksiyonun içeriği aynı kalacak (önceki versiyondan alınabilir)
}
async function fetchTeacherReportData() {
    // ... Bu fonksiyonun içeriği aynı kalacak (önceki versiyondan alınabilir)
}
function setActiveButton(filter) {
     // ... Bu fonksiyonun içeriği aynı kalacak (önceki versiyondan alınabilir)
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
        const inputs = row.querySelectorAll('input[type="time"]');
        let workDays = 0;
        
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
        
        const overtimeMinutes = Math.max(0, weeklyTotalMinutes - (NORMAL_WORK_MINUTES * workDays));
        const normalWorkMinutes = weeklyTotalMinutes - overtimeMinutes;

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

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    await initializePage();
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
