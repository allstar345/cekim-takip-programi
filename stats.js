//
// stats.html'in çalışması için gereken tüm JavaScript kodları buraya taşındı.
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

    if (!permissions.includes('admin') && !permissions.includes('view_stats')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}
checkAuthAndPermissions();


// --- Sayfa İşlevselliği ---
const db = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH);

const teacherStatsBody = document.getElementById('teacher-stats-body');
const directorStatsBody = document.getElementById('director-stats-body');
const loadingDiv = document.getElementById('stats-loading');
const contentDiv = document.getElementById('stats-content');
const logoutBtn = document.getElementById('logout-btn');
const subtitle = document.getElementById('stats-subtitle');
const teacherFilterInput = document.getElementById('teacher-filter-input');
const directorFilterInput = document.getElementById('director-filter-input');

const filterButtons = {
    week: document.getElementById('filter-week'),
    month: document.getElementById('filter-month'),
    all: document.getElementById('filter-all'),
};

let allShootsData = [];
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

function setActiveButton(filter) {
     Object.values(filterButtons).forEach(btn => btn.classList.remove('active'));
     filterButtons[filter].classList.add('active');
     currentFilter = filter;
     calculateAndRenderStats();
}

Object.keys(filterButtons).forEach(key => {
    filterButtons[key].addEventListener('click', () => setActiveButton(key));
});

teacherFilterInput.addEventListener('input', calculateAndRenderStats);
directorFilterInput.addEventListener('input', calculateAndRenderStats);

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
