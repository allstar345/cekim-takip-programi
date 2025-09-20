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

// DOM Elementleri
const teacherStatsBody = document.getElementById('teacher-stats-body');
const directorStatsBody = document.getElementById('director-stats-body');
const loadingDiv = document.getElementById('stats-loading');
const contentDiv = document.getElementById('stats-content');
const logoutBtn = document.getElementById('logout-btn');
const subtitle = document.getElementById('stats-subtitle');
const teacherFilterInput = document.getElementById('teacher-filter-input');
const directorFilterInput = document.getElementById('director-filter-input');
const reportTeacherSelect = document.getElementById('report-teacher-select');
const teacherReportContainer = document.getElementById('teacher-report-container');
const reportTeacherSearch = document.getElementById('report-teacher-search');
const reportFilterDate = document.getElementById('report-filter-date');
const reportFilterDirector = document.getElementById('report-filter-director');
const reportGlobalSearch = document.getElementById('report-global-search');
        
const filterButtons = {
    week: document.getElementById('filter-week'),
    month: document.getElementById('filter-month'),
    all: document.getElementById('filter-all'),
};

const DIRECTORS_LIST = ["Anıl Kolay", "Batuhan Gültekin", "Merve Çoklar", "Nurdan Özveren", "Gözde Bulut", "Ali Yıldırım", "Raşit Güngör"];

let allShootsData = [];
let teacherReportData = []; // Seçilen öğretmenin tüm çekimlerini tutan ana veri
let currentFilter = 'month';

function getThisWeekRange() {
    const today = new Date();
    const firstDayOfWeek = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    const start = new Date(today.setDate(firstDayOfWeek));
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

function calculateAndRenderStats() {
    loadingDiv.classList.remove('hidden');
    contentDiv.classList.add('hidden');
    teacherStatsBody.innerHTML = '';
    directorStatsBody.innerHTML = '';

    let filteredShoots = allShootsData;
    
    if (currentFilter === 'week') {
        const { start, end } = getThisWeekRange();
        filteredShoots = allShootsData.filter(s => {
            if (!s.date) return false;
            const shootDate = new Date(s.date + 'T00:00:00');
            return shootDate >= start && shootDate <= end;
        });
        subtitle.textContent = `Bu haftanın verileri gösterilmektedir.`;
    } else if (currentFilter === 'month') {
        const { start, end } = getThisMonthRange();
        filteredShoots = allShootsData.filter(s => {
            if (!s.date) return false;
            const shootDate = new Date(s.date + 'T00:00:00');
            return shootDate >= start && shootDate <= end;
        });
        subtitle.textContent = `Bu ayın verileri gösterilmektedir.`;
    } else {
         subtitle.textContent = `Tüm zamanlara ait veriler gösterilmektedir.`;
    }
    
    const teacherCounts = filteredShoots.reduce((acc, shoot) => {
        const teacherName = shoot.teacher ? shoot.teacher.trim() : null;
        if (teacherName) { acc[teacherName] = (acc[teacherName] || 0) + 1; }
        return acc;
    }, {});

    const directorCounts = filteredShoots.reduce((acc, shoot) => {
        const directorName = shoot.director ? shoot.director.trim() : null;
        if (directorName) { acc[directorName] = (acc[directorName] || 0) + 1; }
        return acc;
    }, {});

    let sortedTeachers = Object.entries(teacherCounts).sort((a, b) => b[1] - a[1]);
    let sortedDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]);
    
    const teacherFilterText = teacherFilterInput.value.toLowerCase().trim();
    if(teacherFilterText) {
        sortedTeachers = sortedTeachers.filter(([name, count]) => 
            name.toLowerCase().includes(teacherFilterText)
        );
    }
    
    const directorFilterText = directorFilterInput.value.toLowerCase().trim();
    if(directorFilterText) {
        sortedDirectors = sortedDirectors.filter(([name, count]) => 
            name.toLowerCase().includes(directorFilterText)
        );
    }

    teacherStatsBody.innerHTML = sortedTeachers.length ? sortedTeachers.map(([name, count]) => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${count}</td>
        </tr>
    `).join('') : '<tr><td colspan="2" class="text-center p-4 text-gray-500">Sonuç bulunamadı.</td></tr>';

    directorStatsBody.innerHTML = sortedDirectors.length ? sortedDirectors.map(([name, count]) => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${count}</td>
        </tr>
    `).join('') : '<tr><td colspan="2" class="text-center p-4 text-gray-500">Sonuç bulunamadı.</td></tr>';

    loadingDiv.classList.add('hidden');
    contentDiv.classList.remove('hidden');
}

async function populateReportDropdowns() {
    const { data: teachers, error } = await db.from('teachers').select('name').order('name', { ascending: true });
    if (error) {
        console.error("Rapor için öğretmen listesi alınamadı:", error);
        return;
    }
    const teacherOptionsHTML = teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    reportTeacherSelect.innerHTML += teacherOptionsHTML;

    const directorOptionsHTML = DIRECTORS_LIST.sort((a,b) => a.localeCompare(b)).map(d => `<option value="${d}">${d}</option>`).join('');
    reportFilterDirector.innerHTML += directorOptionsHTML;
}

function renderTeacherReport(shootsToRender) {
    if (!reportTeacherSelect.value) {
        teacherReportContainer.innerHTML = `<p class="text-gray-500">Lütfen raporu görüntülemek için bir öğretmen seçin.</p>`;
        return;
    }

    if (!shootsToRender || shootsToRender.length === 0) {
        teacherReportContainer.innerHTML = `<p class="text-gray-500">Bu kriterlere uygun çekim kaydı bulunamadı.</p>`;
        return;
    }

    let tableHTML = `
        <table id="teacher-report-table" class="min-w-full mt-4 text-sm border-collapse">
            <thead class="bg-gray-50">
                <tr>
                    <th>Tarih</th>
                    <th>Çekim Kodu</th>
                    <th>Çekim İçeriği</th>
                    <th>Yönetmen</th>
                </tr>
            </thead>
            <tbody>
    `;
    shootsToRender.forEach(shoot => {
        tableHTML += `
            <tr>
                <td>${new Date(shoot.date + 'T00:00:00').toLocaleDateString('tr-TR')}</td>
                <td>${shoot.shoot_code || '-'}</td>
                <td>${shoot.content || '-'}</td>
                <td>${shoot.director || '-'}</td>
            </tr>
        `;
    });
    tableHTML += `</tbody></table>`;
    teacherReportContainer.innerHTML = tableHTML;
}

function applyReportFilters() {
    if (!reportTeacherSelect.value || teacherReportData.length === 0) {
        renderTeacherReport([]);
        return;
    }

    const filterDate = reportFilterDate.value;
    const filterDirector = reportFilterDirector.value;
    const globalSearchText = reportGlobalSearch.value.toLowerCase().trim();

    let filteredData = teacherReportData;

    if (filterDate) {
        filteredData = filteredData.filter(shoot => shoot.date === filterDate);
    }
    if (filterDirector) {
        filteredData = filteredData.filter(shoot => shoot.director === filterDirector);
    }
    if (globalSearchText) {
        filteredData = filteredData.filter(shoot => 
            (shoot.shoot_code && shoot.shoot_code.toLowerCase().includes(globalSearchText)) ||
            (shoot.content && shoot.content.toLowerCase().includes(globalSearchText)) ||
            (shoot.director && shoot.director.toLowerCase().includes(globalSearchText))
        );
    }
    
    renderTeacherReport(filteredData);
}

function toggleReportFilters(disabled) {
    reportFilterDate.disabled = disabled;
    reportFilterDirector.disabled = disabled;
    reportGlobalSearch.disabled = disabled;
}

async function fetchTeacherReportData() {
    const teacherName = reportTeacherSelect.value;
    
    reportFilterDate.value = '';
    reportFilterDirector.value = '';
    reportGlobalSearch.value = '';
    
    if (!teacherName) {
        teacherReportData = [];
        toggleReportFilters(true);
        applyReportFilters();
        return;
    }

    teacherReportContainer.innerHTML = '<p class="text-gray-500">Rapor yükleniyor...</p>';

    const { data: shoots, error } = await db.from('shoots')
        .select('date, director, shoot_code, content')
        .eq('teacher', teacherName)
        .order('date', { ascending: false });

    if (error) {
        teacherReportContainer.innerHTML = `<p class="text-red-500">Rapor verileri alınırken bir hata oluştu.</p>`;
        toggleReportFilters(true);
        return;
    }

    teacherReportData = shoots || [];
    renderTeacherReport(teacherReportData);
    toggleReportFilters(false);
}


function setActiveButton(filter) {
     Object.values(filterButtons).forEach(btn => btn.classList.remove('active'));
     filterButtons[filter].classList.add('active');
     currentFilter = filter;
     calculateAndRenderStats();
}

// Event Listeners
Object.keys(filterButtons).forEach(key => {
    filterButtons[key].addEventListener('click', () => setActiveButton(key));
});

teacherFilterInput.addEventListener('input', calculateAndRenderStats);
directorFilterInput.addEventListener('input', calculateAndRenderStats);

reportTeacherSearch.addEventListener('input', () => {
    const searchText = reportTeacherSearch.value.toLowerCase();
    Array.from(reportTeacherSelect.options).forEach(option => {
        const isVisible = option.value === '' || option.text.toLowerCase().includes(searchText);
        option.style.display = isVisible ? '' : 'none';
    });
});


reportTeacherSelect.addEventListener('change', () => {
    const selectedTeacher = reportTeacherSelect.value;
    reportTeacherSearch.value = selectedTeacher; // Arama kutusunu senkronize et
    fetchTeacherReportData();
});

reportFilterDate.addEventListener('change', applyReportFilters);
reportFilterDirector.addEventListener('change', applyReportFilters);
reportGlobalSearch.addEventListener('input', applyReportFilters);


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

document.addEventListener('DOMContentLoaded', async () => {
    populateReportDropdowns();
    applyReportFilters(); // Başlangıçta "öğretmen seçin" mesajını göstermek ve filtreleri pasif etmek için
    const { data, error } = await db.from('shoots').select('*');
    if (error) {
        loadingDiv.innerHTML = `<p class="text-red-500">Veriler alınırken bir hata oluştu: ${error.message}</p>`;
    } else {
        const today = new Date();
        today.setHours(23, 59, 59, 999); 
        
        allShootsData = data.filter(shoot => {
            if (!shoot.date) return false;
            const shootDate = new Date(shoot.date + 'T00:00:00');
            return shootDate <= today;
        });

        setActiveButton('month');
    }
});
