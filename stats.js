// =================================================================================
// BÖLÜM 1: TEMEL KURULUM, DEĞİŞKENLER VE YARDIMCI FONKSİYONLAR
// =================================================================================

// --- Yetkilendirme ve Supabase Bağlantısı ---
const SUPABASE_URL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';

const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: ()=>{}, removeItem: ()=>{} };
const supabaseAuth = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: authStorageAdapter } });
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
// YENİ: İstatistik navigasyon elementleri
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
let currentStatsDate = new Date(); // YENİ: İstatistikler için tarih takibi
let currentStatsFilter = 'month';

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
const HHMMToMinutes = (timeStr) => { if (!timeStr || !timeStr.includes(':')) return 0; const [hours, minutes] = timeStr.split(':').map(Number); return (hours * 60) + minutes; };
const minutesToHHMM = (totalMinutes) => { if (isNaN(totalMinutes) || totalMinutes < 0) totalMinutes = 0; const hours = Math.floor(totalMinutes / 60); const minutes = Math.round(totalMinutes % 60); return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; };

// =================================================================================
// BÖLÜM 2: GENEL İSTATİSTİKLER VE AÇILIR/KAPANIR MEKANİZMASI
// =================================================================================
function renderGeneralStats() {
    if (!statsContent) return;

    let filteredShoots = allShootsData;
    let range;

    if (currentStatsFilter === 'week') {
        range = getWeekRange(currentStatsDate);
        filteredShoots = allShootsData.filter(s => {
            const shootDate = new Date(s.date + 'T00:00:00');
            return s.date && shootDate >= range.start && shootDate <= range.end;
        });
        statsPeriodDisplay.textContent = `${range.start.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} - ${range.end.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}`;
        statsSubtitle.textContent = 'Seçilen haftanın verileri gösterilmektedir.';
    } else if (currentStatsFilter === 'month') {
        range = getMonthRange(currentStatsDate);
        filteredShoots = allShootsData.filter(s => {
            const shootDate = new Date(s.date + 'T00:00:00');
            return s.date && shootDate >= range.start && shootDate <= range.end;
        });
        statsPeriodDisplay.textContent = currentStatsDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        statsSubtitle.textContent = 'Seçilen ayın verileri gösterilmektedir.';
    } else {
        statsSubtitle.textContent = 'Tüm zamanlara ait veriler gösterilmektedir.';
    }

    const teacherCounts = filteredShoots.reduce((acc, shoot) => { if (shoot.teacher) { acc[shoot.teacher] = (acc[shoot.teacher] || 0) + 1; } return acc; }, {});
    const directorCounts = filteredShoots.reduce((acc, shoot) => { if (shoot.director) { acc[shoot.director] = (acc[shoot.director] || 0) + 1; } return acc; }, {});
    
    let sortedTeachers = Object.entries(teacherCounts).sort((a, b) => b[1] - a[1]);
    let sortedDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]);
    
    const teacherFilterText = teacherStatsFilter.value.toLowerCase().trim();
    if (teacherFilterText) {
        sortedTeachers = sortedTeachers.filter(([name]) => name.toLowerCase().includes(teacherFilterText));
    }
    const directorFilterText = directorStatsFilter.value.toLowerCase().trim();
    if (directorFilterText) {
        sortedDirectors = sortedDirectors.filter(([name]) => name.toLowerCase().includes(directorFilterText));
    }
    
    teacherStatsBody.innerHTML = sortedTeachers.map(([name, count]) => `<tr><td class="px-4 py-2">${name}</td><td class="px-4 py-2 text-center">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç bulunamadı.</td></tr>';
    directorStatsBody.innerHTML = sortedDirectors.map(([name, count]) => `<tr><td class="px-4 py-2">${name}</td><td class="px-4 py-2 text-center">${count}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center p-4">Sonuç bulunamadı.</td></tr>';
    
    statsLoading.classList.add('hidden');
    statsContent.classList.remove('hidden');
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
function setupCollapsibleSections() { const reportHeader = document.getElementById('report-section-header'); const reportContent = document.getElementById('report-section-content'); const reportIcon = document.getElementById('report-toggle-icon'); const timesheetHeader = document.getElementById('timesheet-section-header'); const timesheetContent = document.getElementById('timesheet-section-content'); const timesheetIcon = document.getElementById('timesheet-toggle-icon'); const toggleSection = (content, icon) => { const isHidden = content.classList.toggle('hidden'); icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)'; }; reportIcon.style.transform = 'rotate(0deg)'; timesheetIcon.style.transform = 'rotate(0deg)'; reportHeader.addEventListener('click', () => toggleSection(reportContent, reportIcon)); timesheetHeader.addEventListener('click', () => toggleSection(timesheetContent, timesheetIcon)); }

// =================================================================================
// BÖLÜM 3: DETAYLI ÇEKİM DÖKÜMÜ (RAPORLAMA VE SAYFALAMA)
// =================================================================================
function renderTeacherReport() { if (filteredReportData.length === 0) { teacherReportContainer.innerHTML = `<p class="text-gray-500 text-center py-4">Bu kriterlere uygun çekim kaydı bulunamadı.</p>`; renderPaginationControls(); return; } const startIndex = (reportCurrentPage - 1) * REPORT_ROWS_PER_PAGE; const endIndex = startIndex + REPORT_ROWS_PER_PAGE; const paginatedItems = filteredReportData.slice(startIndex, endIndex); let tableHTML = `<table id="teacher-report-table" class="min-w-full text-sm"><thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left">Tarih</th><th class="px-4 py-2 text-left">Öğretmen</th><th class="px-4 py-2 text-left">Çekim Kodu</th><th class="px-4 py-2 text-left">Çekim İçeriği</th><th class="px-4 py-2 text-left">Yönetmen</th></tr></thead><tbody>${paginatedItems.map(shoot => `<tr><td class="px-4 py-2">${new Date(shoot.date + 'T00:00:00').toLocaleDateString('tr-TR')}</td><td class="px-4 py-2">${shoot.teacher || '-'}</td><td class="px-4 py-2">${shoot.shoot_code || '-'}</td><td class="px-4 py-2">${shoot.content || '-'}</td><td class="px-4 py-2">${shoot.director || '-'}</td></tr>`).join('')}</tbody></table>`; teacherReportContainer.innerHTML = tableHTML; renderPaginationControls(); }
function renderPaginationControls() { reportPaginationContainer.innerHTML = ''; reportTotalCount.textContent = `Toplam ${filteredReportData.length} kayıt bulundu.`; const pageCount = Math.ceil(filteredReportData.length / REPORT_ROWS_PER_PAGE); if (pageCount <= 1) return; let paginationHTML = ''; paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${reportCurrentPage - 1})" ${reportCurrentPage === 1 ? 'disabled' : ''}>&laquo;</button>`; for (let i = 1; i <= pageCount; i++) { paginationHTML += `<button class="pagination-btn ${i === reportCurrentPage ? 'active' : ''}" onclick="changeReportPage(${i})">${i}</button>`; } paginationHTML += `<button class="pagination-btn" onclick="changeReportPage(${reportCurrentPage + 1})" ${reportCurrentPage === pageCount ? 'disabled' : ''}>&raquo;</button>`; reportPaginationContainer.innerHTML = paginationHTML; }
window.changeReportPage = (page) => { const pageCount = Math.ceil(filteredReportData.length / REPORT_ROWS_PER_PAGE); if (page < 1 || page > pageCount) return; reportCurrentPage = page; renderTeacherReport(); };
function applyReportFilters() { let filtered = [...allShootsData]; if (reportTeacherSelect.value) filtered = filtered.filter(s => s.teacher === reportTeacherSelect.value); if (reportFilterDate.value) filtered = filtered.filter(s => s.date === reportFilterDate.value); if (reportFilterDirector.value) filtered = filtered.filter(s => s.director === reportFilterDirector.value); if (reportGlobalSearch.value) { const searchText = reportGlobalSearch.value.toLowerCase(); filtered = filtered.filter(s => (s.teacher && s.teacher.toLowerCase().includes(searchText)) || (s.shoot_code && s.shoot_code.toLowerCase().includes(searchText)) || (s.content && s.content.toLowerCase().includes(searchText)) || (s.director && s.director.toLowerCase().includes(searchText))); } filteredReportData = filtered.sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00')); reportCurrentPage = 1; renderTeacherReport(); }
async function populateReportDropdowns() { const { data: teachers } = await db.from('teachers').select('name').order('name'); if (teachers) { reportTeacherSelect.innerHTML = '<option value="">Tümü</option>' + teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join(''); } const directors = [...new Set(allShootsData.map(s => s.director).filter(Boolean))].sort(); reportFilterDirector.innerHTML = '<option value="">Tümü</option>' + directors.map(d => `<option value="${d}">${d}</option>`).join(''); }

// =================================================================================
// BÖLÜM 4: HAFTALIK MESAİ DÖKÜMÜ
// =================================================================================
// Bu bölüm bilerek boş bırakılmıştır, önceki adımdaki çalışan kod aynı şekilde kalacaktır.

// =================================================================================
// BÖLÜM 5: ANA FONKSİYON VE OLAY DİNLEYİCİLER
// =================================================================================
async function initializePage() {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    const { data, error } = await db.from('shoots').select('*');
    if (error) {
        teacherReportContainer.innerHTML = `<p class="text-red-500">Veriler alınamadı.</p>`;
        return;
    }
    allShootsData = data;
    
    // YENİ: Başlangıçta "Bu Ay" filtresini ve navigasyonu aktifleştir.
    setActiveStatsButton('month'); 
    
    await populateReportDropdowns();
    applyReportFilters();
    // await renderTimesheet(); // Mesai dökümü kısmı bu adımda değiştirilmedi.
    setupCollapsibleSections();
    
    Object.keys(filterButtons).forEach(key => {
        filterButtons[key].addEventListener('click', () => setActiveStatsButton(key));
    });

    // YENİ: Önceki/Sonraki dönem butonları için olay dinleyicileri
    statsPrevPeriodBtn.addEventListener('click', () => {
        if (currentStatsFilter === 'week') {
            currentStatsDate.setDate(currentStatsDate.getDate() - 7);
        } else if (currentStatsFilter === 'month') {
            currentStatsDate.setMonth(currentStatsDate.getMonth() - 1);
        }
        renderGeneralStats();
    });

    statsNextPeriodBtn.addEventListener('click', () => {
        if (currentStatsFilter === 'week') {
            currentStatsDate.setDate(currentStatsDate.getDate() + 7);
        } else if (currentStatsFilter === 'month') {
            currentStatsDate.setMonth(currentStatsDate.getMonth() + 1);
        }
        renderGeneralStats();
    });

    teacherStatsFilter.addEventListener('input', renderGeneralStats);
    directorStatsFilter.addEventListener('input', renderGeneralStats);
    [reportTeacherSelect, reportFilterDate, reportFilterDirector].forEach(el => { el.addEventListener('change', applyReportFilters); });
    reportGlobalSearch.addEventListener('input', applyReportFilters);
    // prevWeekTimesheetBtn.addEventListener('click', () => { currentTimesheetDate.setDate(currentTimesheetDate.getDate() - 7); renderTimesheet(); });
    // nextWeekTimesheetBtn.addEventListener('click', () => { currentTimesheetDate.setDate(currentTimesheetDate.getDate() + 7); renderTimesheet(); });
    // saveTimesheetBtn.addEventListener('click', saveTimesheet);
    // timesheetContainer.addEventListener('input', (e) => { /* ... */ });
    logoutBtn.addEventListener('click', async () => { await supabaseAuth.auth.signOut(); window.location.href = 'login.html'; });
}

document.addEventListener('DOMContentLoaded', initializePage);
