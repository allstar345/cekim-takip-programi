import { supabaseUrl, supabaseAnonKey } from './config.js';

// =================================================================================
// BÖLÜM 1: TEMEL KURULUM, DEĞİŞKENLER VE YARDIMCI FONKSİYONLAR
// =================================================================================

// --- Yetkilendirme ve Supabase Bağlantısı ---
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key) };
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });
const db = supabaseClient;

// --- DOM Elementleri ---
const logoutBtn = document.getElementById('logout-btn');
const statsLoading = document.getElementById('stats-loading');
const statsContent = document.getElementById('stats-content');
const statsSubtitle = document.getElementById('stats-subtitle');
const teacherStatsBody = document.getElementById('teacher-stats-body');
const directorStatsBody = document.getElementById('director-stats-body');
const teacherStatsFilter = document.getElementById('teacher-stats-filter');
const directorStatsFilter = document.getElementById('director-stats-filter');
const filterButtons = { week: document.getElementById('filter-week'), month: document.getElementById('filter-month'), all: document.getElementById('filter-all') };
const teacherReportContainer = document.getElementById('teacher-report-container');
const reportTeacherSelect = document.getElementById('report-teacher-select');
const reportFilterDate = document.getElementById('report-filter-date');
const reportFilterDirector = document.getElementById('report-filter-director');
const reportGlobalSearch = document.getElementById('report-global-search');
const reportTotalCount = document.getElementById('report-total-count');
const reportPaginationContainer = document.getElementById('report-pagination-container');
const timesheetContainer = document.getElementById('timesheet-container');
const prevWeekTimesheetBtn = document.getElementById('prev-week-timesheet');
const nextWeekTimesheetBtn = document.getElementById('next-week-timesheet');
const weekRangeDisplayTimesheet = document.getElementById('week-range-display-timesheet');
const saveTimesheetBtn = document.getElementById('save-timesheet-btn');
const statsPeriodNavigator = document.getElementById('stats-period-navigator');
const statsPrevPeriodBtn = document.getElementById('stats-prev-period');
const statsNextPeriodBtn = document.getElementById('stats-next-period');
const statsPeriodDisplay = document.getElementById('stats-period-display');

// --- Global Değişkenler ---
let allShootsData = [];
let filteredReportData = [];
let reportCurrentPage = 1;
const REPORT_ROWS_PER_PAGE = 10;
let currentTimesheetDate = new Date();
let currentStatsDate = new Date();
let currentStatsFilter = 'month';
const WEEKLY_NORMAL_HOURS_LIMIT = 45; 
const ALL_DIRECTORS = ["Anıl Kolay", "Batuhan Gültekin", "Merve Çoklar", "Nurdan Özveren", "Gözde Bulut", "Ali Yıldırım", "Raşit Güngör"];

// Grafik instance'larını saklamak için global değişkenler
let studioChartInstance;
let personnelChartInstance;

// --- Yardımcı Fonksiyonlar ---
const getWeekRange = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const daysToSubtract = day === 0 ? 6 : day - 1;
    const start = new Date(d);
    start.setDate(d.getDate() - daysToSubtract);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};
const getMonthRange = (date = new Date()) => { const d = new Date(date); const start = new Date(d.getFullYear(), d.getMonth(), 1); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); end.setHours(23, 59, 59, 999); return { start, end }; };
const getWeekIdentifier = (d) => { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`; };
const HHMMToMinutes = (timeStr) => { if (typeof timeStr !== 'string' || !timeStr.includes(':')) return 0; const [hours, minutes] = timeStr.split(':').map(Number); return (hours * 60) + minutes; };
const minutesToHHMM = (totalMinutes) => { if (isNaN(totalMinutes) || totalMinutes < 0) totalMinutes = 0; const hours = Math.floor(totalMinutes / 60); const minutes = Math.round(totalMinutes % 60); return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; };
const toYYYYMMDD = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;


// =================================================================================
// BÖLÜM 2: YENİ GRAFİK OLUŞTURMA FONKSİYONU
// =================================================================================
function renderCharts(filteredShoots) {
    // --- GRAFİK 1: STÜDYO DOLULUK (BAR GRAFİĞİ) ---
    const studioData = {}; 
    filteredShoots.forEach(shoot => {
        if (shoot.studio && shoot.start_time && shoot.end_time) {
            const duration = HHMMToMinutes(shoot.end_time) - HHMMToMinutes(shoot.start_time);
            if (duration > 0) {
                studioData[shoot.studio] = (studioData[shoot.studio] || 0) + duration;
            }
        }
    });

    const sortedStudios = Object.entries(studioData).sort(([, a], [, b]) => b - a);
    const studioLabels = sortedStudios.map(([name]) => name);
    const studioHoursData = sortedStudios.map(([, minutes]) => (minutes / 60).toFixed(1));

    const studioCtx = document.getElementById('studioOccupancyChart').getContext('2d');
    if (studioChartInstance) {
        studioChartInstance.destroy();
    }
    studioChartInstance = new Chart(studioCtx, {
        type: 'bar',
        data: {
            labels: studioLabels,
            datasets: [{
                label: 'Toplam Çekim Saati',
                data: studioHoursData,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { callback: function(value) { return value + ' sa'; } }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    // --- GRAFİK 2: PERSONEL PERFORMANSI (YATAY BAR GRAFİĞİ) ---
    const personnelCounts = {};
    const personnelDayCounter = new Set();
    filteredShoots.forEach(shoot => {
        if (shoot.teacher && shoot.date) personnelDayCounter.add(`${shoot.teacher}-${shoot.date}`);
        if (shoot.director && shoot.date) personnelDayCounter.add(`${shoot.director}-${shoot.date}`);
    });
    personnelDayCounter.forEach(entry => {
        const personName = entry.substring(0, entry.lastIndexOf('-'));
        personnelCounts[personName] = (personnelCounts[personName] || 0) + 1;
    });

    const sortedPersonnel = Object.entries(personnelCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    const personnelLabels = sortedPersonnel.map(([name]) => name);
    const personnelData = sortedPersonnel.map(([, count]) => count);

    const personnelCtx = document.getElementById('personnelPerformanceChart').getContext('2d');
    if (personnelChartInstance) {
        personnelChartInstance.destroy();
    }
    personnelChartInstance = new Chart(personnelCtx, {
        type: 'bar',
        data: {
            labels: personnelLabels,
            datasets: [{
                label: 'Çalışılan Gün Sayısı',
                data: personnelData,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { 
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// =================================================================================
// BÖLÜM 3: MEVCUT FONKSİYONLARIN DOĞRU HALLERİ
// =================================================================================

function renderGeneralStats() {
    if (!statsContent) return;
    let filteredShoots = allShootsData;
    let range;
    if (currentStatsFilter === 'week') {
        range = getWeekRange(currentStatsDate);
        const today = new Date();
        const isCurrentWeek = today >= range.start && today <= range.end;
        const startDateString = toYYYYMMDD(range.start);
        const endDateString = isCurrentWeek ? toYYYYMMDD(today) : toYYYYMMDD(range.end);
        filteredShoots = allShootsData.filter(s => s.date && s.date >= startDateString && s.date <= endDateString);
        statsPeriodDisplay.textContent = `${range.start.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} - ${range.end.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}`;
        statsSubtitle.textContent = isCurrentWeek ? 'Bu haftanın verileri (bugüne kadar) gösterilmektedir.' : 'Seçilen haftanın verileri gösterilmektedir.';
    } else if (currentStatsFilter === 'month') {
        range = getMonthRange(currentStatsDate);
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === currentStatsDate.getFullYear() && today.getMonth() === currentStatsDate.getMonth();
        const startDateString = toYYYYMMDD(range.start);
        const endDateString = isCurrentMonth ? toYYYYMMDD(today) : toYYYYMMDD(range.end);
        filteredShoots = allShootsData.filter(s => s.date && s.date >= startDateString && s.date <= endDateString);
        statsPeriodDisplay.textContent = currentStatsDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        statsSubtitle.textContent = isCurrentMonth ? 'Bu ayın verileri (bugüne kadar) gösterilmektedir.' : 'Seçilen ayın verileri gösterilmektedir.';
    } else {
        filteredShoots = allShootsData;
        statsSubtitle.textContent = 'Tüm zamanlara ait veriler gösterilmektedir.';
    }
    
    const teacherDaySet = new Set();
    filteredShoots.forEach(shoot => {
        if (shoot.teacher && shoot.date) {
            teacherDaySet.add(`${shoot.teacher}-${shoot.date}`);
        }
    });
    const teacherCounts = {};
    teacherDaySet.forEach(entry => {
        const teacherName = entry.substring(0, entry.lastIndexOf('-'));
        teacherCounts[teacherName] = (teacherCounts[teacherName] || 0) + 1;
    });
    
    const directorCounts = {};
    ALL_DIRECTORS.forEach(director => { directorCounts[director] = 0; });
    filteredShoots.forEach(shoot => {
        if (shoot.director && directorCounts.hasOwnProperty(shoot.director)) {
            directorCounts[shoot.director]++;
        }
    });
    
    let sortedTeachers = Object.entries(teacherCounts).sort((a, b) => b[1] - a[1]);
    let sortedDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]);
    
    const teacherFilterText = teacherStatsFilter.value.toLowerCase().trim();
    if (teacherFilterText) { sortedTeachers = sortedTeachers.filter(([name]) => name.toLowerCase().includes(teacherFilterText)); }
    const directorFilterText = directorStatsFilter.value.toLowerCase().trim();
    if (directorFilterText) { sortedDirectors = sortedDirectors.filter(([name]) => name.toLowerCase().includes(directorFilterText)); }
    
    teacherStatsBody.innerHTML = sortedTeachers.map(([name, count]) => `<tr><td class="px-4 py-2">${name}</td><td class="px-4 py-2 text-center">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç bulunamadı.</td></tr>';
    directorStatsBody.innerHTML = sortedDirectors.map(([name, count]) => `<tr><td class="px-4 py-2">${name}</td><td class="px-4 py-2 text-center">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç bulunamadı.</td></tr>';
    
    statsLoading.classList.add('hidden');
    statsContent.classList.remove('hidden');

    renderCharts(filteredShoots); // Grafikleri çiz
}

function setActiveStatsButton(filter) {
    currentStatsFilter = filter;
    Object.values(filterButtons).forEach(btn => btn.classList.remove('active'));
    filterButtons[filter].classList.add('active');
    if (filter === 'week' || filter === 'month') {
        statsPeriodNavigator.classList.remove('hidden');
        statsPeriodNavigator.classList.add('flex');
        currentStatsDate = new Date();
    } else {
        statsPeriodNavigator.classList.add('hidden');
        statsPeriodNavigator.classList.remove('flex');
    }
    renderGeneralStats();
}

function setupCollapsibleSections() {
    const reportHeader = document.getElementById('report-section-header');
    const reportContent = document.getElementById('report-section-content');
    const reportIcon = document.getElementById('report-toggle-icon');
    const timesheetHeader = document.getElementById('timesheet-section-header');
    const timesheetContent = document.getElementById('timesheet-section-content');
    const timesheetIcon = document.getElementById('timesheet-toggle-icon');
    const toggleSection = (content, icon) => {
        const isHidden = content.classList.toggle('hidden');
        icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    };
    if(reportIcon) reportIcon.style.transform = 'rotate(0deg)';
    if(timesheetIcon) timesheetIcon.style.transform = 'rotate(0deg)';
    if(reportHeader) reportHeader.addEventListener('click', () => toggleSection(reportContent, reportIcon));
    if(timesheetHeader) timesheetHeader.addEventListener('click', () => toggleSection(timesheetContent, timesheetIcon));
}

function renderTeacherReport() { if (!teacherReportContainer) return; if (filteredReportData.length === 0) { teacherReportContainer.innerHTML = `<p class="text-gray-500 text-center py-4">Bu kriterlere uygun çekim kaydı bulunamadı.</p>`; renderPaginationControls(); return; } const startIndex = (reportCurrentPage - 1) * REPORT_ROWS_PER_PAGE; const endIndex = startIndex + REPORT_ROWS_PER_PAGE; const paginatedItems = filteredReportData.slice(startIndex, endIndex); let tableHTML = `<table id="teacher-report-table" class="min-w-full text-sm"><thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left">Tarih</th><th class="px-4 py-2 text-left">Öğretmen</th><th class="px-4 py-2 text-left">Çekim Kodu</th><th class="px-4 py-2 text-left">Çekim İçeriği</th><th class="px-4 py-2 text-left">Yönetmen</th></tr></thead><tbody>${paginatedItems.map(shoot => `<tr><td class="px-4 py-2">${new Date(shoot.date + 'T00:00:00').toLocaleDateString('tr-TR')}</td><td class="px-4 py-2">${shoot.teacher || '-'}</td><td class="px-4 py-2">${shoot.shoot_code || '-'}</td><td class="px-4 py-2">${shoot.content || '-'}</td><td class="px-4 py-2">${shoot.director || '-'}</td></tr>`).join('')}</tbody></table>`; teacherReportContainer.innerHTML = tableHTML; renderPaginationControls(); }
function renderPaginationControls() { if (!reportPaginationContainer) return; reportPaginationContainer.innerHTML = ''; reportTotalCount.textContent = `Toplam ${filteredReportData.length} kayıt bulundu.`; const pageCount = Math.ceil(filteredReportData.length / REPORT_ROWS_PER_PAGE); if (pageCount <= 1) return; let paginationHTML = ''; paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${reportCurrentPage - 1})" ${reportCurrentPage === 1 ? 'disabled' : ''}>&laquo;</button>`; for (let i = 1; i <= pageCount; i++) { paginationHTML += `<button class="pagination-btn ${i === reportCurrentPage ? 'active' : ''}" onclick="changeReportPage(${i})">${i}</button>`; } paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${reportCurrentPage + 1})" ${reportCurrentPage === pageCount ? 'disabled' : ''}>&raquo;</button>`; reportPaginationContainer.innerHTML = paginationHTML; }
window.changeReportPage = (page) => { const pageCount = Math.ceil(filteredReportData.length / REPORT_ROWS_PER_PAGE); if (page < 1 || page > pageCount) return; reportCurrentPage = page; renderTeacherReport(); };
function applyReportFilters() { let filtered = [...allShootsData]; if (reportTeacherSelect.value) filtered = filtered.filter(s => s.teacher === reportTeacherSelect.value); if (reportFilterDate.value) filtered = filtered.filter(s => s.date === reportFilterDate.value); if (reportFilterDirector.value) filtered = filtered.filter(s => s.director === reportFilterDirector.value); if (reportGlobalSearch.value) { const searchText = reportGlobalSearch.value.toLowerCase(); filtered = filtered.filter(s => (s.teacher && s.teacher.toLowerCase().includes(searchText)) || (s.shoot_code && s.shoot_code.toLowerCase().includes(searchText)) || (s.content && s.content.toLowerCase().includes(searchText)) || (s.director && s.director.toLowerCase().includes(searchText))); } filteredReportData = filtered.sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00')); reportCurrentPage = 1; renderTeacherReport(); }
async function populateReportDropdowns() { const { data: teachers } = await db.from('teachers').select('name').order('name'); if (teachers) { reportTeacherSelect.innerHTML = '<option value="">Tümü</option>' + teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join(''); } const directors = [...new Set(allShootsData.map(s => s.director).filter(Boolean))].sort(); reportFilterDirector.innerHTML = '<option value="">Tümü</option>' + directors.map(d => `<option value="${d}">${d}</option>`).join(''); }
function updateTimesheetWeekDisplay() { const { start, end } = getWeekRange(currentTimesheetDate); weekRangeDisplayTimesheet.textContent = `${start.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit'})} - ${end.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit', year:'numeric'})}`; }
async function renderTimesheet() {
    updateTimesheetWeekDisplay();
    timesheetContainer.innerHTML = `<p class="text-gray-500 text-center py-8">Mesai verileri yükleniyor...</p>`;
    const { start } = getWeekRange(currentTimesheetDate);
    const currentWeekStart = new Date(start);
    const weekIdentifier = getWeekIdentifier(currentWeekStart);
    const startDateStr = `${currentWeekStart.getFullYear()}-${String(currentWeekStart.getMonth() + 1).padStart(2, '0')}-${String(currentWeekStart.getDate()).padStart(2, '0')}`;
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    const endDateStr = `${currentWeekEnd.getFullYear()}-${String(currentWeekEnd.getMonth() + 1).padStart(2, '0')}-${String(currentWeekEnd.getDate()).padStart(2, '0')}`;
    const { data: shootsInWeek } = await db.from('shoots').select('date, day, director, start_time, end_time').gte('date', startDateStr).lte('date', endDateStr);
    const { data: teamsInWeek } = await db.from('daily_teams').select('*').eq('week_identifier', weekIdentifier);
    const employeeSet = new Set();
    const autoTimes = {};
    const teamSchedule = new Map();
    if (teamsInWeek) { teamsInWeek.forEach(d => teamSchedule.set(d.day_of_week, d.team_members || [])); }
    if (shootsInWeek) { shootsInWeek.forEach(s => { if (s.director) employeeSet.add(s.director); }); }
    if (teamsInWeek) { teamsInWeek.forEach(t => (t.team_members || []).forEach(m => employeeSet.add(m))); }
    if (shootsInWeek) {
        shootsInWeek.forEach(shoot => {
            if (!shoot.date || !shoot.day || !shoot.start_time || !shoot.end_time) return;
            const peopleForThisShoot = new Set();
            if (shoot.director) peopleForThisShoot.add(shoot.director);
            const teamForDay = teamSchedule.get(shoot.day) || [];
            teamForDay.forEach(member => peopleForThisShoot.add(member));
            peopleForThisShoot.forEach(person => {
                const key = `${person}-${shoot.date}`;
                if (!autoTimes[key]) { autoTimes[key] = { start: shoot.start_time, end: shoot.end_time }; } 
                else {
                    if (shoot.start_time < autoTimes[key].start) autoTimes[key].start = shoot.start_time;
                    if (shoot.end_time > autoTimes[key].end) autoTimes[key].end = autoTimes[key].end;
                }
            });
        });
    }
    const employees = Array.from(employeeSet).sort((a, b) => a.localeCompare(b));
    if (employees.length === 0) { timesheetContainer.innerHTML = `<p class="text-gray-500 text-center py-8">Bu hafta için planlanmış bir çekim veya görevli çalışan bulunamadı.</p>`; return; }
    const { data: savedTimesheetData } = await db.from('employee_timesheets').select('*').eq('week_identifier', weekIdentifier);
    const savedTimesheetMap = new Map(savedTimesheetData?.map(d => [`${d.employee_name}-${d.day_of_week}`, d]));
    const weekDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    let tableHTML = `<table id="timesheet-table" class="min-w-full text-sm"><thead class="bg-gray-50"><tr><th class="sticky left-0 bg-gray-50 z-10 w-48 text-left">Çalışan</th>${weekDays.map(day => `<th class="text-left">${day}</th>`).join('')}<th class="text-left">Toplam Normal</th><th class="text-left">Toplam Mesai</th></tr></thead><tbody>`;
    employees.forEach(employee => {
        tableHTML += `<tr data-employee="${employee}"><td class="sticky left-0 bg-white font-medium text-gray-800 z-10">${employee}</td>`;
        weekDays.forEach((day, index) => {
            const dateStr = weekDates[index];
            const savedEntry = savedTimesheetMap.get(`${employee}-${day}`);
            const autoEntry = autoTimes[`${employee}-${dateStr}`];
            let startTime, endTime, colorClass = '';
            const autoStartTime = autoEntry?.start?.substring(0, 5) ?? '';
            const autoEndTime = autoEntry?.end?.substring(0, 5) ?? '';
            if (savedEntry) {
                startTime = savedEntry.start_time?.substring(0, 5) ?? '';
                endTime = savedEntry.end_time?.substring(0, 5) ?? '';
                if (startTime !== autoStartTime || endTime !== autoEndTime) {
                    if (startTime || endTime) { colorClass = 'text-red-600 font-semibold'; }
                }
            } else {
                startTime = autoStartTime;
                endTime = autoEndTime;
            }
            tableHTML += `<td><div class="flex items-center space-x-1"><input type="time" class="start-time w-full ${colorClass}" value="${startTime}" data-day="${day}"><input type="time" class="end-time w-full ${colorClass}" value="${endTime}" data-day="${day}"></div></td>`;
        });
        tableHTML += `<td class="total-work font-semibold text-right pr-2">00:00</td><td class="total-overtime font-semibold text-right pr-2">00:00</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    timesheetContainer.innerHTML = tableHTML;
    calculateAllTotals();
}
function calculateAllTotals() {
    const weeklyNormalMinutesLimit = WEEKLY_NORMAL_HOURS_LIMIT * 60;
    document.querySelectorAll('#timesheet-table tbody tr').forEach(row => {
        let weeklyTotalMinutes = 0;
        row.querySelectorAll('.start-time').forEach((startInput, index) => {
            const endInput = row.querySelectorAll('.end-time')[index];
            if (startInput.value && endInput.value) {
                let duration = HHMMToMinutes(endInput.value) - HHMMToMinutes(startInput.value);
                if (duration > 0) {
                    if (duration > 300) { duration -= 60; }
                    weeklyTotalMinutes += duration;
                }
            }
        });
        const normalWorkMinutes = Math.min(weeklyTotalMinutes, weeklyNormalMinutesLimit);
        const overtimeMinutes = Math.max(0, weeklyTotalMinutes - weeklyNormalMinutesLimit);
        row.querySelector('.total-work').textContent = minutesToHHMM(normalWorkMinutes);
        row.querySelector('.total-overtime').textContent = minutesToHHMM(overtimeMinutes);
    });
}
async function saveTimesheet() { saveTimesheetBtn.disabled = true; saveTimesheetBtn.textContent = 'Kaydediliyor...'; const weekIdentifier = getWeekIdentifier(currentTimesheetDate); const dataToUpsert = []; document.querySelectorAll('#timesheet-table tbody tr').forEach(row => { const employeeName = row.dataset.employee; row.querySelectorAll('input.start-time').forEach(startInput => { const day = startInput.dataset.day; const endInput = row.querySelector(`input.end-time[data-day="${day}"]`); dataToUpsert.push({ week_identifier: weekIdentifier, employee_name: employeeName, day_of_week: day, start_time: startInput.value || null, end_time: endInput.value || null }); }); }); const { error } = await db.from('employee_timesheets').upsert(dataToUpsert, { onConflict: 'week_identifier, employee_name, day_of_week' }); if (error) { Swal.fire('Hata!', `Mesai kaydedilemedi: ${error.message}`, 'error'); } else { Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Mesai Tablosu Kaydedildi', showConfirmButton: false, timer: 2000 }); } saveTimesheetBtn.disabled = false; saveTimesheetBtn.textContent = 'Değişiklikleri Kaydet'; }

async function initializePage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    
    const { data, error } = await db.from('shoots').select('*');
    if (error) { 
        teacherReportContainer.innerHTML = `<p class="text-red-500">Veriler alınamadı.</p>`; 
        return; 
    }
    
    allShootsData = data;
    setActiveStatsButton('month'); 
    await populateReportDropdowns();
    applyReportFilters();
    await renderTimesheet();
    setupCollapsibleSections();

    Object.keys(filterButtons).forEach(key => {
        filterButtons[key].addEventListener('click', () => setActiveStatsButton(key));
    });
    statsPrevPeriodBtn.addEventListener('click', () => {
        if (currentStatsFilter === 'week') { currentStatsDate.setDate(currentStatsDate.getDate() - 7); } 
        else if (currentStatsFilter === 'month') { currentStatsDate.setMonth(currentStatsDate.getMonth() - 1); }
        renderGeneralStats();
    });
    statsNextPeriodBtn.addEventListener('click', () => {
        if (currentStatsFilter === 'week') { currentStatsDate.setDate(currentStatsDate.getDate() + 7); } 
        else if (currentStatsFilter === 'month') { currentStatsDate.setMonth(currentStatsDate.getMonth() + 1); }
        renderGeneralStats();
    });
    teacherStatsFilter.addEventListener('input', renderGeneralStats);
    directorStatsFilter.addEventListener('input', renderGeneralStats);
    [reportTeacherSelect, reportFilterDate, reportFilterDirector].forEach(el => { 
        if(el) el.addEventListener('change', applyReportFilters); 
    });
    if(reportGlobalSearch) reportGlobalSearch.addEventListener('input', applyReportFilters);
    if(prevWeekTimesheetBtn) prevWeekTimesheetBtn.addEventListener('click', () => { currentTimesheetDate.setDate(currentTimesheetDate.getDate() - 7); renderTimesheet(); });
    if(nextWeekTimesheetBtn) nextWeekTimesheetBtn.addEventListener('click', () => { currentTimesheetDate.setDate(currentTimesheetDate.getDate() + 7); renderTimesheet(); });
    if(saveTimesheetBtn) saveTimesheetBtn.addEventListener('click', saveTimesheet);
    if(timesheetContainer) timesheetContainer.addEventListener('input', (e) => { 
        if (e.target.matches('input[type="time"]')) { 
            calculateAllTotals(); 
            const parentDiv = e.target.parentElement;
            const startInput = parentDiv.querySelector('.start-time');
            const endInput = parentDiv.querySelector('.end-time');
            startInput.classList.add('text-red-600', 'font-semibold');
            endInput.classList.add('text-red-600', 'font-semibold');
        } 
    }); 
    logoutBtn.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; });
}
document.addEventListener('DOMContentLoaded', initializePage);
bana tam ver bu kodu
