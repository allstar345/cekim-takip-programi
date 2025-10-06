import { supabaseUrl, supabaseAnonKey } from './config.js';

// --- Yetki Kontrolü ---
const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: ()=>{}, removeItem: ()=>{} };
const supabaseAuth = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });

async function checkAuthAndPermissions() {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const { data: { user } } = await supabaseAuth.auth.getUser();
    const permissions = user?.user_metadata?.permissions || [];

    if (!permissions.includes('admin') && !permissions.includes('view_cekim')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}
checkAuthAndPermissions();


// --- Sayfa İşlevselliği ---
const mainStorageAdapter = {
    getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
    setItem: (key, value) => { localStorage.setItem(key, value); },
    removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); },
};

const db = supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: { storage: mainStorageAdapter }
});

let allShoots = []; 
let groupedShoots = {};
let sortedWeeks = [];
let currentPage = 0;
let currentEditId = null;

// DOM Elementleri
const form = document.getElementById('shoot-form');
const weeklyContainer = document.getElementById('weekly-view-container');
const loadingDiv = document.getElementById('loading');
const noDataDiv = document.getElementById('no-data');
const prevBtn = document.getElementById('prev-week-btn');
const nextBtn = document.getElementById('next-week-btn');
const weekRangeDisplay = document.getElementById('week-range-display');
const navControls = document.getElementById('navigation-controls');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-edit-btn');
const formHeaderClickable = document.getElementById('form-header-clickable');
const formWrapper = document.getElementById('form-wrapper');
const toggleIcon = document.getElementById('toggle-icon');
const filterDay = document.getElementById('filter-day');
const filterStudio = document.getElementById('filter-studio');
const filterTeacher = document.getElementById('filter-teacher');
const recordCount = document.getElementById('record-count');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const logoutBtn = document.getElementById('logout-btn');
const dateInput = document.getElementById('date');
const daySelect = document.getElementById('day');
const dailyLeavesContainer = document.getElementById('daily-leaves-container');
const dailyLeavesPlanner = document.getElementById('daily-leaves-planner');
const filterEmployee = document.getElementById('filter-employee');
const directorSelectForm = document.getElementById('director');
const kameraman1SelectForm = document.getElementById('kameraman_1');
const kameraman2SelectForm = document.getElementById('kameraman_2');


// Sabit Listeler
const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const STUDIOS = ["Stüdyo 1", "Stüdyo 2", "Stüdyo 4", "Stüdyo 7", "Stüdyo 8"];
const TEAM_MEMBERS = ["Emirhan", "Eren", "Yavuz Selim"];
const ON_LEAVE_MEMBERS = ["Burak Onay", "Raşit Güngör", "Ali Yıldırım", "Rahim Ural", "İsmail Tolga Aktaş", "Sinem Şentürk", "Merve Çoklar", "Nurdan Özveren", "Emirhan Topçu", "Eren Genç", "Yavuz Selim İnce", "Anıl Kolay", "Batuhan Gültekin", "Gözde Bulut", "Mert Katıhan", "Recep Yurttaş", "Taner Akçil"];
const DIRECTORS = ["Anıl Kolay", "Batuhan Gültekin", "Merve Çoklar", "Nurdan Özveren", "Gözde Bulut", "Ali Yıldırım", "Raşit Güngör"];
const CAMERAMEN = ["Mert Katıhan", "Recep Yurttaş", "Taner Akçil"];

const teacherSelectForm = document.getElementById('teacher');
const teacherSelectFilter = document.getElementById('filter-teacher');

async function populateTeacherDropdowns() {
    const { data: teachers, error } = await db.from('teachers').select('name').order('name', { ascending: true });
    
    if (error) {
        console.error('Öğretmen listesi veritabanından alınamadı:', error);
        return;
    }
    
    const teacherOptionsHTML = teachers.map(teacher => `<option value="${teacher.name}">${teacher.name}</option>`).join('');
    
    teacherSelectForm.innerHTML += teacherOptionsHTML;
    teacherSelectFilter.innerHTML += teacherOptionsHTML;
}

function populateStaticDropdowns() {
    const directorOptionsHTML = DIRECTORS.sort((a,b) => a.localeCompare(b)).map(d => `<option value="${d}">${d}</option>`).join('');
    directorSelectForm.innerHTML += directorOptionsHTML;

    const employeeOptionsHTML = ON_LEAVE_MEMBERS.sort((a,b) => a.localeCompare(b)).map(e => `<option value="${e}">${e}</option>`).join('');
    filterEmployee.innerHTML += employeeOptionsHTML;

    const cameramanOptionsHTML = CAMERAMEN.sort((a,b) => a.localeCompare(b)).map(c => `<option value="${c}">${c}</option>`).join('');
    kameraman1SelectForm.innerHTML += cameramanOptionsHTML;
    kameraman2SelectForm.innerHTML += cameramanOptionsHTML;
}

function getRowColorClass(day) {
    switch (day) {
        case 'Pazartesi': return 'bg-green-50';
        case 'Salı': return 'bg-red-50';
        case 'Çarşamba': return 'bg-yellow-50';
        case 'Perşembe': return 'bg-purple-50';
        case 'Cuma': return 'bg-blue-50';
        case 'Cumartesi': return 'bg-orange-50';
        case 'Pazar': return 'bg-stone-100';
        default: return 'bg-white';
    }
}

function getWeekIdentifier(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function getMondayOfIsoWeek(year, week) {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay();
    const isoWeekStart = simple;
    if (dayOfWeek <= 4) {
        isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    } else {
        isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    }
    return isoWeekStart;
}

function getWeekDateRange(year, weekNo) {
    const monday = getMondayOfIsoWeek(year, weekNo);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: monday, end: sunday };
}

async function processAndRenderData() {
    const selectedDay = filterDay.value;
    const selectedStudio = filterStudio.value;
    const selectedTeacher = filterTeacher.value;
    const selectedEmployee = filterEmployee.value;
    
    let filteredShoots = allShoots;

    if (selectedDay) {
        filteredShoots = filteredShoots.filter(shoot => shoot.day === selectedDay);
    }
    if (selectedStudio) {
        filteredShoots = filteredShoots.filter(shoot => shoot.studio === selectedStudio);
    }
    if (selectedTeacher) {
        filteredShoots = filteredShoots.filter(shoot => shoot.teacher === selectedTeacher);
    }

    if (selectedEmployee) {
        const { data: allTeams } = await db.from('daily_teams').select('*');
        const { data: allLeaves } = await db.from('daily_leaves').select('*');

        const teamSchedule = new Map();
        if (allTeams) {
            allTeams.forEach(d => teamSchedule.set(`${d.week_identifier}-${d.day_of_week}`, d.team_members || []));
        }

        const leaveSchedule = new Map();
        if (allLeaves) {
            allLeaves.forEach(d => leaveSchedule.set(`${d.week_identifier}-${d.day_of_week}`, d.on_leave_members || []));
        }

        filteredShoots = filteredShoots.filter(shoot => {
            if (!shoot.date || !shoot.day) return false;

            const weekKey = getWeekIdentifier(new Date(shoot.date + 'T12:00:00'));
            const scheduleKey = `${weekKey}-${shoot.day}`;

            const isOnLeave = (leaveSchedule.get(scheduleKey) || []).includes(selectedEmployee);
            
            if (isOnLeave) {
                return false;
            }
            
            const isDirector = shoot.director === selectedEmployee;
            const isOnTeam = (teamSchedule.get(scheduleKey) || []).includes(selectedEmployee);

            return isDirector || isOnTeam;
        });
    }

    groupedShoots = {};
    filteredShoots.forEach(shoot => {
        if (shoot.date) {
            const shootDate = new Date(shoot.date + 'T00:00:00');
            if (!isNaN(shootDate.getTime())) {
                const weekKey = getWeekIdentifier(shootDate);
                if (!groupedShoots[weekKey]) {
                    groupedShoots[weekKey] = [];
                }
                groupedShoots[weekKey].push(shoot);
            }
        }
    });

    sortedWeeks = Object.keys(groupedShoots).sort().reverse();
    currentPage = 0;
    renderCurrentPage();
}

async function renderCurrentPage() {
    loadingDiv.classList.add('hidden');
    weeklyContainer.innerHTML = '';

    const hasAnyDataAtAll = allShoots.length > 0;

    if (!hasAnyDataAtAll) {
        noDataDiv.classList.remove('hidden');
        navControls.classList.add('hidden');
        dailyLeavesContainer.classList.add('hidden');
        return;
    }
    
    noDataDiv.classList.add('hidden');
    navControls.classList.remove('hidden');
    dailyLeavesContainer.classList.remove('hidden');

    let weekKey = sortedWeeks[currentPage];
    
    if (!weekKey && allShoots.length > 0) {
        const today = new Date();
        const currentWeekKey = getWeekIdentifier(today);
        if (!groupedShoots[currentWeekKey]) {
            groupedShoots[currentWeekKey] = [];
            sortedWeeks.push(currentWeekKey);
            sortedWeeks.sort().reverse();
            currentPage = sortedWeeks.indexOf(currentWeekKey);
        }
        weekKey = sortedWeeks[currentPage];
    }
    
    if (!weekKey) {
        noDataDiv.classList.remove('hidden');
        navControls.classList.add('hidden');
        dailyLeavesContainer.classList.add('hidden');
        return;
    }
    
    const [year, weekNo] = weekKey.split('-').map(Number);
    const dateRange = getWeekDateRange(year, weekNo);
    const shootsForWeek = groupedShoots[weekKey] || [];
    
    recordCount.textContent = `Gösterilen hafta için ${shootsForWeek.length} kayıt bulundu.`;

    let { data: dailyTeams, error: teamError } = await db.from('daily_teams').select('*').eq('week_identifier', weekKey);
    let { data: dailyLeaves, error: leaveError } = await db.from('daily_leaves').select('*').eq('week_identifier', weekKey);

    if (teamError) { console.error("Günlük ekip verisi alınırken hata:", teamError); dailyTeams = []; }
    if (leaveError) { console.error("Günlük izinli verisi alınırken hata:", leaveError); dailyLeaves = []; }
    
    const dailyTeamsMap = new Map((dailyTeams || []).map(d => [d.day_of_week, d.team_members]));
    const dailyLeavesMap = new Map((dailyLeaves || []).map(d => [d.day_of_week, d.on_leave_members]));

    renderDailyLeavesPlanner(dailyLeavesMap);
    
    const timetableHtml = createTimetableHtml(shootsForWeek, dailyTeamsMap);
    weeklyContainer.innerHTML = timetableHtml;
    
    updateNavControls();
}

function renderDailyLeavesPlanner(dailyLeavesMap) {
    dailyLeavesPlanner.innerHTML = '';
    
    DAYS_OF_WEEK.forEach(day => {
        const onLeaveForDay = dailyLeavesMap.get(day) || [];
        const onLeaveIsSet = onLeaveForDay.length > 0;
        
        const dayContainer = document.createElement('div');
        dayContainer.className = 'border p-2 rounded-lg';
        
        let badgesHTML = onLeaveIsSet
            ? onLeaveForDay.map(member => `<span class="inline-block bg-gray-200 text-gray-800 text-xs font-medium mr-1 mb-1 px-2 py-0.5 rounded-full">${member}</span>`).join('')
            : '<p class="text-xs text-gray-400">İzinli yok</p>';

        dayContainer.innerHTML = `
            <p class="font-bold text-sm text-center">${day}</p>
            <div class="mt-2 min-h-[40px]">${badgesHTML}</div>
            <button data-day="${day}" class="daily-leave-edit-btn text-indigo-600 hover:underline text-xs w-full text-center mt-1">Düzenle</button>
        `;
        dailyLeavesPlanner.appendChild(dayContainer);
    });
}

function createTimetableHtml(shoots, dailyTeamsMap) {
    const gridData = {};
    const weekKey = sortedWeeks[currentPage];

    DAYS_OF_WEEK.forEach(day => {
        gridData[day] = {};
        STUDIOS.forEach(studio => {
            gridData[day][studio] = [];
        });
    });

    shoots.forEach(shoot => {
        if (shoot.day && shoot.studio && gridData[shoot.day] && gridData[shoot.day][shoot.studio]) {
            gridData[shoot.day][shoot.studio].push(shoot);
        }
    });

    const headerHtml = `
        <thead>
            <tr>
                <th class="w-1/12">Gün</th>
                ${STUDIOS.map(studio => `<th>${studio}</th>`).join('')}
            </tr>
        </thead>
    `;

    const bodyHtml = DAYS_OF_WEEK.map(day => {
        const dayColorClass = getRowColorClass(day);
        const teamForDay = dailyTeamsMap.get(day) || [];
        const teamIsSet = teamForDay.length > 0;

        const teamDisplayHTML = `
            <div class="p-1 text-xs">
                <div class="text-blue-600 font-normal min-h-[1.5rem] ${teamIsSet ? '' : 'hidden'}">
                    ${teamForDay.join(', ')}
                </div>
                <button data-day="${day}" class="daily-team-edit-btn text-indigo-600 hover:underline mt-1">
                    ${teamIsSet ? 'Ekibi Düzenle' : 'Ekip Ata'}
                </button>
            </div>
        `;

        const cellsHtml = STUDIOS.map(studio => {
            const shootsInCell = gridData[day][studio];
            shootsInCell.sort((a,b) => (a.start_time || a.time || '').localeCompare(b.start_time || b.time || ''));

            const cellContent = shootsInCell.map(shoot => {
                let timeDisplay = '';
                if (shoot.start_time && shoot.end_time) {
                    timeDisplay = `${shoot.start_time.substring(0, 5)} - ${shoot.end_time.substring(0, 5)}`;
                } else if (shoot.time) { 
                    timeDisplay = shoot.time;
                }

                let cameramanDisplayHtml = '';
                if (shoot.kameraman_1 || shoot.kameraman_2) {
                    cameramanDisplayHtml = `<p class="text-gray-500 text-xs">K: ${shoot.kameraman_1 || '-'} / ${shoot.kameraman_2 || '-'}</p>`;
                }

                return `
                <div class="shoot-entry text-left">
                    <p class="font-semibold text-gray-800">${shoot.teacher || ''}</p>
                    <p class="text-gray-600">${timeDisplay}</p>
                    <p class="text-gray-500 text-xs">${shoot.content || ''}</p>
                    <p class="text-gray-500 text-xs italic mt-1">Y: ${shoot.director || '-'}</p>
                    ${cameramanDisplayHtml}
                    <div class="flex items-center justify-end space-x-1 mt-2">
                         <button data-id="${shoot.id}" class="edit-btn text-xs text-indigo-600 hover:text-indigo-900 p-1 rounded-md bg-indigo-50 hover:bg-indigo-100">D</button>
                         <button data-id="${shoot.id}" class="delete-btn text-xs text-red-600 hover:text-red-900 p-1 rounded-md bg-red-50 hover:bg-red-100">S</button>
                    </div>
                </div>
                `;
            }).join('');
            
            return `<td class="timetable-cell">${cellContent}</td>`;
        }).join('');
        
        return `<tr class="${dayColorClass} hover:brightness-95 transition-all duration-200"><td class="day-header"><div>${day}</div>${teamDisplayHTML}</td>${cellsHtml}</tr>`;
    }).join('');

    return `
         <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div class="p-6 md:p-8 bg-gray-50 border-b border-gray-200">
                <h2 class="text-xl font-bold text-gray-900">Çekim Planı</h2>
            </div>
            <div class="overflow-x-auto p-4">
                <table class="timetable">
                    ${headerHtml}
                    <tbody>${bodyHtml}</tbody>
                </table>
            </div>
        </div>
    `;
}

function updateNavControls() {
    nextBtn.disabled = currentPage === 0;
    const maxPage = sortedWeeks.length - 1;
    prevBtn.disabled = currentPage >= maxPage;

    const currentWeekKey = sortedWeeks[currentPage];
    let displayStr = 'Gösterilecek Hafta Bulunamadı';
    if (currentWeekKey) {
        const [year, weekNo] = currentWeekKey.split('-').map(Number);
        const range = getWeekDateRange(year, weekNo);
        displayStr = `Gösterilen Hafta: ${range.start.toLocaleDateString('tr-TR', {day: 'numeric', month: 'long'})} - ${range.end.toLocaleDateString('tr-TR', {day: 'numeric', month: 'long', year: 'numeric'})}`;
    }
    weekRangeDisplay.textContent = displayStr;
}

function populateFormForEdit(shoot) {
    const elements = form.elements;
    elements['date'].value = shoot.date || '';
    elements['day'].value = shoot.day || '';
    elements['studio'].value = shoot.studio || '';
    elements['teacher'].value = shoot.teacher || '';
    elements['start_time'].value = shoot.start_time || '';
    elements['end_time'].value = shoot.end_time || '';
    elements['director'].value = shoot.director || '';
    elements['kameraman_1'].value = shoot.kameraman_1 || '';
    elements['kameraman_2'].value = shoot.kameraman_2 || '';
    elements['shoot_code'].value = shoot.shoot_code || '';
    elements['content'].value = shoot.content || '';

    currentEditId = shoot.id;
    submitBtn.textContent = 'Kaydı Güncelle';
    cancelBtn.classList.remove('hidden');
    if (formWrapper.classList.contains('collapsed')) {
        formWrapper.classList.remove('collapsed');
        toggleIcon.classList.remove('rotate-180');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormState() {
    form.reset();
    currentEditId = null;
    submitBtn.textContent = 'Çekim Ekle';
    cancelBtn.classList.add('hidden');
}

dateInput.addEventListener('change', () => {
    const secilenTarih = dateInput.value;
    if (!secilenTarih) return;
    const tarihObjesi = new Date(secilenTarih + 'T12:00:00'); 
    const gunIndex = tarihObjesi.getDay(); 
    const gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const gunAdi = gunler[gunIndex];
    daySelect.value = gunAdi;
});

formHeaderClickable.addEventListener('click', () => {
    formWrapper.classList.toggle('collapsed');
    toggleIcon.classList.toggle('rotate-180');
});

filterDay.addEventListener('change', processAndRenderData);
filterStudio.addEventListener('change', processAndRenderData);
filterTeacher.addEventListener('change', processAndRenderData);
filterEmployee.addEventListener('change', processAndRenderData);

prevBtn.addEventListener('click', () => {
    const maxPage = sortedWeeks.length - 1;
    if (currentPage < maxPage) {
        currentPage++;
        renderCurrentPage();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentPage > 0) {
        currentPage--;
        renderCurrentPage();
    }
});

document.querySelector('main').addEventListener('click', async (e) => {
    const target = e.target;
    const weekKey = sortedWeeks[currentPage];

    if (!weekKey) return;

    if (target.classList.contains('daily-team-edit-btn')) {
        const day = target.dataset.day;
        
        const { data } = await db.from('daily_teams').select('team_members').eq('week_identifier', weekKey).eq('day_of_week', day).single();
        const currentlySelected = data ? data.team_members : [];

        const { value: selectedMembers } = await Swal.fire({
            title: `${day} Günü Ekibini Seç`,
            html: TEAM_MEMBERS.map(member => `
                <div class="flex items-center my-2 justify-center">
                    <input type="checkbox" id="member-team-${member}" value="${member}" class="swal2-checkbox h-5 w-5" ${currentlySelected.includes(member) ? 'checked' : ''}>
                    <label for="member-team-${member}" class="ml-2">${member}</label>
                </div>
            `).join(''),
            confirmButtonText: 'Kaydet',
            showCancelButton: true,
            cancelButtonText: 'İptal',
            preConfirm: () => {
                return TEAM_MEMBERS
                    .filter(member => document.getElementById(`member-team-${member}`).checked)
                    .map(member => document.getElementById(`member-team-${member}`).value);
            }
        });

        if (typeof selectedMembers !== 'undefined') {
            const { error } = await db.from('daily_teams').upsert({
                week_identifier: weekKey,
                day_of_week: day,
                team_members: selectedMembers
            }, { onConflict: 'week_identifier, day_of_week' });

            if (error) {
                console.error('Ekip kaydedilirken hata oluştu:', error);
                Swal.fire('Hata!', 'Ekip planı kaydedilirken bir hata oluştu.', 'error');
            } else {
                renderCurrentPage();
            }
        }
    }
    
    if (target.classList.contains('daily-leave-edit-btn')) {
        const day = target.dataset.day;

        const { data } = await db.from('daily_leaves').select('on_leave_members').eq('week_identifier', weekKey).eq('day_of_week', day).single();
        const currentlyOnLeave = data ? data.on_leave_members : [];

        const { value: selectedOnLeave } = await Swal.fire({
            title: `${day} Günü İzinlilerini Seç`,
            html: ON_LEAVE_MEMBERS.sort((a,b) => a.localeCompare(b)).map(member => `
                <div class="flex items-center my-2 justify-start text-left w-1/2 mx-auto">
                    <input type="checkbox" id="member-leave-${member.replace(/\s+/g, '-')}" value="${member}" class="swal2-checkbox h-5 w-5" ${currentlyOnLeave.includes(member) ? 'checked' : ''}>
                    <label for="member-leave-${member.replace(/\s+/g, '-')}" class="ml-2">${member}</label>
                </div>
            `).join(''),
            confirmButtonText: 'Kaydet',
            showCancelButton: true,
            cancelButtonText: 'İptal',
            width: '40em',
            preConfirm: () => {
                return ON_LEAVE_MEMBERS
                    .filter(member => document.getElementById(`member-leave-${member.replace(/\s+/g, '-')}`).checked)
                    .map(member => document.getElementById(`member-leave-${member.replace(/\s+/g, '-')}`).value);
            }
        });
        
        if (typeof selectedOnLeave !== 'undefined') {
            const { error } = await db.from('daily_leaves').upsert({
                week_identifier: weekKey,
                day_of_week: day,
                on_leave_members: selectedOnLeave
            }, { onConflict: 'week_identifier, day_of_week' });

            if (error) {
                console.error('İzinliler kaydedilirken hata oluştu:', error);
                Swal.fire('Hata!', 'İzinli listesi kaydedilirken bir hata oluştu.', 'error');
            } else {
                renderCurrentPage();
            }
        }
    }

    const buttonInTable = e.target.closest('.shoot-entry button');
    if (buttonInTable) {
        if (buttonInTable.classList.contains('delete-btn')) {
            const id = buttonInTable.getAttribute('data-id');
            Swal.fire({
                title: 'Emin misiniz?',
                text: "Bu çekim planı kalıcı olarak silinecektir!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Evet, sil!',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await db.from('shoots').delete().eq('id', id);
                }
            });
        }
        if (buttonInTable.classList.contains('edit-btn')) {
            const id = buttonInTable.getAttribute('data-id');
            const shootToEdit = allShoots.find(shoot => shoot.id === Number(id)); 
            if (shootToEdit) {
                populateFormForEdit(shootToEdit);
            }
        }
    }
});

cancelBtn.addEventListener('click', resetFormState);

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    
    const shootData = {
        studio: formData.get('studio'),
        teacher: formData.get('teacher'),
        date: formData.get('date'),
        day: formData.get('day'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        director: formData.get('director'),
        kameraman_1: formData.get('kameraman_1'),
        kameraman_2: formData.get('kameraman_2'),
        shoot_code: formData.get('shoot_code'),
        content: formData.get('content'),
    };

    if (!shootData.date || !shootData.start_time || !shootData.end_time) {
        Swal.fire('Eksik Bilgi!', 'Lütfen tarih, başlangıç ve bitiş saatlerini girin.', 'warning');
        return;
    }

    if (shootData.start_time >= shootData.end_time) {
        Swal.fire('Hata!', 'Bitiş saati, başlangıç saatinden sonra olmalıdır.', 'error');
        return;
    }

    // --- KONTROL 1: İZİN GÜNÜ KONTROLÜ ---
    const weekKeyForSubmit = getWeekIdentifier(new Date(shootData.date + 'T12:00:00'));
    const { data: leaveData } = await db.from('daily_leaves').select('on_leave_members').eq('week_identifier', weekKeyForSubmit).eq('day_of_week', shootData.day).single();
    const onLeaveToday = leaveData ? leaveData.on_leave_members : [];

    if (shootData.director && onLeaveToday.includes(shootData.director)) {
        Swal.fire('Hata!', `Seçtiğiniz yönetmen (${shootData.director}) bu gün için izinli olarak işaretlenmiş.`, 'error');
        return;
    }

    if (shootData.teacher && onLeaveToday.includes(shootData.teacher)) {
        Swal.fire('Hata!', `Seçtiğiniz öğretmen (${shootData.teacher}) bu gün için izinli olarak işaretlenmiş.`, 'error');
        return;
    }

    // --- KONTROL 2: PERSONEL BAZLI ÇAKIŞMA KONTROLÜ ---
    const personnelToCheck = [shootData.director, shootData.teacher].filter(Boolean);
    if (personnelToCheck.length > 0) {
        const { data: personnelShoots, error: personnelError } = await db.from('shoots')
            .select('start_time, end_time, teacher, director, studio')
            .eq('date', shootData.date)
            .or(`director.in.(${personnelToCheck.map(p => `"${p}"`).join(',')}),teacher.in.(${personnelToCheck.map(p => `"${p}"`).join(',')})`)
            .not('start_time', 'is', null)
            .not('end_time', 'is', null)
            .neq('id', currentEditId || 0);

        if (personnelError) {
            console.error('Personel çakışma kontrolü sırasında hata:', personnelError);
            Swal.fire('Hata!', 'Veritabanı kontrolü sırasında bir hata oluştu.', 'error');
            return;
        }

        for (const pShoot of personnelShoots) {
            if (shootData.start_time < pShoot.end_time && shootData.end_time > pShoot.start_time) {
                const conflictingPerson = personnelToCheck.find(p => p === pShoot.director || p === pShoot.teacher);
                Swal.fire(
                    'Personel Çakışması!',
                    `${conflictingPerson} isimli personel, saat ${pShoot.start_time.substring(0,5)}-${pShoot.end_time.substring(0,5)} aralığında ${pShoot.studio} için zaten planlanmış.`,
                    'error'
                );
                return;
            }
        }
    }

    // --- KONTROL 3: STÜDYO BAZLI ÇAKIŞMA KONTROLÜ ---
    if (currentEditId === null) { 
        const { data: existingShoots, error: fetchError } = await db.from('shoots')
            .select('start_time, end_time, teacher')
            .eq('date', shootData.date)
            .eq('studio', shootData.studio)
            .not('start_time', 'is', null)
            .not('end_time', 'is', null);

        if (fetchError) {
            console.error('Stüdyo çakışma kontrolü sırasında hata:', fetchError);
            Swal.fire('Hata!', 'Veritabanı kontrolü sırasında bir hata oluştu.', 'error');
            return;
        }

        for (const existing of existingShoots) {
            if (shootData.start_time < existing.end_time && shootData.end_time > existing.start_time) {
                Swal.fire({
                    icon: 'error',
                    title: 'Stüdyo Çakışması!',
                    text: `Bu stüdyo seçtiğiniz tarih ve saat aralığında (${existing.start_time.substring(0,5)} - ${existing.end_time.substring(0,5)}) ${existing.teacher} tarafından zaten rezerve edilmiş.`,
                });
                return;
            }
        }
    }

    // --- VERİTABANI İŞLEMİ ---
    let error;
    if (currentEditId) {
        ({ error } = await db.from('shoots').update(shootData).eq('id', currentEditId));
    } else {
        ({ error } = await db.from('shoots').insert([shootData]));
    }

    if (error) {
        console.error("Veri kaydetme/güncelleme hatası: ", error);
        Swal.fire({
            icon: 'error',
            title: 'Hata!',
            text: 'Çekim planı kaydedilirken bir hata oluştu.'
        });
    } else {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: currentEditId ? 'Çekim Planı Güncellendi' : 'Çekim Planı Eklendi',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        resetFormState();
    }
});

downloadPdfBtn.addEventListener('click', () => {
    const timetableElement = document.querySelector('#weekly-view-container .bg-white');
    if (!timetableElement) {
        alert("İndirilecek bir tablo bulunamadı.");
        return;
    }

    const originalBtnText = downloadPdfBtn.innerHTML;
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.innerHTML = 'İndiriliyor...';

    html2canvas(timetableElement, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        
        const pdfWidth = canvas.width;
        const pdfHeight = canvas.height;
        const orientation = pdfWidth > pdfHeight ? 'l' : 'p';

        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [pdfWidth, pdfHeight]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        const weekText = weekRangeDisplay.textContent.replace('Gösterilen Hafta: ', '');
        pdf.save(`cekim_plani_${weekText}.pdf`);
    }).catch(err => {
        console.error("PDF oluşturma hatası:", err);
        alert("PDF oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
    }).finally(() => {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.innerHTML = originalBtnText;
    });
});

logoutBtn.addEventListener('click', async () => {
    const mainStorageAdapter = {
        getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
        setItem: (key, value) => { localStorage.setItem(key, value); sessionStorage.setItem(key, value); },
        removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); },
    };
    const supabase_logout = supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { storage: mainStorageAdapter }
    });
    await supabase_logout.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});

async function fetchInitialData() {
    loadingDiv.classList.remove('hidden'); 
    const { data, error } = await db.from('shoots').select('*');
    if (error) {
        console.error("Veri alınamadı:", error);
        loadingDiv.innerText = "Veriler alınırken bir hata oluştu.";
    } else {
        allShoots = data;
        await processAndRenderData(); 
    }
}

const shootsSubscription = db.channel('public:shoots')
    .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shoots' },
        (payload) => {
            console.log('Değişiklik algılandı!', payload);
            fetchInitialData();
        }
    )
    .subscribe();

document.addEventListener('DOMContentLoaded', async () => {
    populateTeacherDropdowns();
    populateStaticDropdowns();
    await fetchInitialData();
    
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const permissions = user?.user_metadata?.permissions || [];
    
    if (!permissions.includes('admin') && !permissions.includes('view_stats')) {
        const statsLink = document.getElementById('stats-link');
        if (statsLink) {
            statsLink.removeAttribute('href');
            statsLink.classList.add('opacity-50', 'cursor-not-allowed');
            statsLink.addEventListener('click', e => {
                e.preventDefault();
            });
        }
    }
});
