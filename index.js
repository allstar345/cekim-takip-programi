//
// index.html'in çalışması için gereken tüm JavaScript kodları buraya taşındı.
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

const db = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH, {
    auth: { storage: mainStorageAdapter }
});

let allShoots = []; 
let groupedShoots = {};
let sortedWeeks = [];
let currentPage = 0;
let currentEditId = null;

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

const DAYS_OF_WEEK = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const STUDIOS = ["Stüdyo 1", "Stüdyo 2", "Stüdyo 4", "Stüdyo 7", "Stüdyo 8"];
const TEAM_MEMBERS = ["Emirhan", "Eren", "Yavuz Selim"];

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

function processAndRenderData() {
    const selectedDay = filterDay.value;
    const selectedStudio = filterStudio.value;
    const selectedTeacher = filterTeacher.value;
    
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

    recordCount.textContent = `Toplam ${filteredShoots.length} kayıt bulundu.`;

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

    const hasAnyData = Object.keys(groupedShoots).length > 0;

    if (!hasAnyData) {
        noDataDiv.classList.remove('hidden');
        navControls.classList.add('hidden');
        return;
    }
    
    noDataDiv.classList.add('hidden');
    navControls.classList.remove('hidden');

    const weekKey = sortedWeeks[currentPage];
    if (!weekKey) {
         noDataDiv.classList.remove('hidden');
        navControls.classList.add('hidden');
        return;
    }
    
    const [year, weekNo] = weekKey.split('-').map(Number);
    const dateRange = getWeekDateRange(year, weekNo);
    const shootsForWeek = groupedShoots[weekKey] || [];
    
    let { data: dailyTeams, error } = await db.from('daily_teams').select('*').eq('week_identifier', weekKey);
    if (error) {
        console.error("Günlük ekip verisi alınırken hata:", error);
        dailyTeams = []; 
    }
    const dailyTeamsMap = new Map(dailyTeams.map(d => [d.day_of_week, d.team_members]));

    const timetableHtml = createTimetableHtml(shootsForWeek, dailyTeamsMap);
    weeklyContainer.innerHTML = timetableHtml;
    
    updateNavControls();
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

        // Estetik görünüm için ekip listesi ve düzenle butonu
        const teamDisplayHTML = `
            <div class="p-1 text-xs">
                <div class="text-blue-600 font-normal ${teamIsSet ? '' : 'hidden'}">
                    ${teamForDay.join(', ')}
                </div>
                <button data-day="${day}" data-week="${weekKey}" class="daily-team-edit-btn text-indigo-600 hover:underline mt-1">
                    ${teamIsSet ? 'Düzenle' : 'Ekip Ata'}
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

                return `
                <div class="shoot-entry text-left">
                    <p class="font-semibold text-gray-800">${shoot.teacher || ''}</p>
                    <p class="text-gray-600">${timeDisplay}</p>
                    <p class="text-gray-500 text-xs">${shoot.content || ''}</p>
                    <p class="text-gray-500 text-xs italic mt-1">${shoot.director || ''}</p>
                    <div class="flex items-center justify-end space-x-1 mt-2">
                         <button data-id="${shoot.id}" class="edit-btn text-xs text-indigo-600 hover:text-indigo-900 p-1 rounded-md bg-indigo-50 hover:bg-indigo-100">D</button>
                         <button data-id="${shoot.id}" class="delete-btn text-xs text-red-600 hover:text-red-900 p-1 rounded-md bg-red-50 hover:bg-red-100">S</button>
                    </div>
                </div>
            `}).join('');
            
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

weeklyContainer.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    // YENİ: GÜNLÜK EKİP DÜZENLEME BUTONU MANTIĞI
    if (target.classList.contains('daily-team-edit-btn')) {
        const day = target.dataset.day;
        const week = target.dataset.week;

        // Mevcut seçili ekibi al
        const { data } = await db.from('daily_teams').select('team_members').eq('week_identifier', week).eq('day_of_week', day).single();
        const currentlySelected = data ? data.team_members : [];

        // SweetAlert2 ile checkbox'lı bir pencere aç
        const { value: selectedMembers } = await Swal.fire({
            title: `${day} Günü Ekibini Seç`,
            html: TEAM_MEMBERS.map(member => `
                <div class="flex items-center my-2">
                    <input type="checkbox" id="member-${member}" value="${member}" class="swal2-checkbox" ${currentlySelected.includes(member) ? 'checked' : ''}>
                    <label for="member-${member}" class="ml-2">${member}</label>
                </div>
            `).join(''),
            confirmButtonText: 'Kaydet',
            showCancelButton: true,
            cancelButtonText: 'İptal',
            preConfirm: () => {
                return TEAM_MEMBERS
                    .filter(member => document.getElementById(`member-${member}`).checked)
                    .map(member => document.getElementById(`member-${member}`).value);
            }
        });

        // Kullanıcı "Kaydet" dediyse ve seçim değiştiyse
        if (selectedMembers) {
            const { error } = await db.from('daily_teams').upsert({
                week_identifier: week,
                day_of_week: day,
                team_members: selectedMembers
            }, { onConflict: 'week_identifier, day_of_week' });

            if (error) {
                console.error('Ekip kaydedilirken hata oluştu:', error);
                Swal.fire('Hata!', 'Ekip planı kaydedilirken bir hata oluştu.', 'error');
            } else {
                // Başarılı kayıttan sonra tabloyu yeniden çizerek güncel ekibi göster
                renderCurrentPage();
            }
        }
    }

    if (target.classList.contains('delete-btn')) {
        const id = target.getAttribute('data-id');
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
    if (target.classList.contains('edit-btn')) {
        const id = target.getAttribute('data-id');
        const shootToEdit = allShoots.find(shoot => shoot.id === Number(id)); 
        if (shootToEdit) {
            populateFormForEdit(shootToEdit);
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
        content: formData.get('content'),
    };

    if (shootData.start_time >= shootData.end_time) {
        Swal.fire('Hata!', 'Bitiş saati, başlangıç saatinden sonra olmalıdır.', 'error');
        return;
    }

    if (currentEditId === null) {
        const { data: existingShoots, error: fetchError } = await db.from('shoots')
            .select('start_time, end_time, teacher')
            .eq('date', shootData.date)
            .eq('studio', shootData.studio)
            .not('start_time', 'is', null)
            .not('end_time', 'is', null);

        if (fetchError) {
            console.error('Çakışma kontrolü sırasında hata:', fetchError);
            Swal.fire('Hata!', 'Veritabanı kontrolü sırasında bir hata oluştu.', 'error');
            return;
        }

        let isConflict = false;
        for (const existing of existingShoots) {
            if (shootData.start_time < existing.end_time && shootData.end_time > existing.start_time) {
                isConflict = true;
                Swal.fire({
                    icon: 'error',
                    title: 'Çakışma Var!',
                    text: `Bu stüdyo seçtiğiniz tarih ve saat aralığında (${existing.start_time.substring(0,5)} - ${existing.end_time.substring(0,5)}) ${existing.teacher} tarafından zaten rezerve edilmiş.`,
                });
                break;
            }
        }

        if (isConflict) {
            return;
        }
    }

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

        const weekText = weekRangeDisplay.textContent.replace('Gösterilen Haftfta: ', '');
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
    const supabase_logout = supabase.createClient(SUPABASE_URL_AUTH, SUPABASE_ANON_KEY_AUTH, {
        auth: { storage: mainStorageAdapter }
    });
    await supabase_logout.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});

async function fetchInitialData() {
    const { data, error } = await db.from('shoots').select('*');
    if (error) {
        console.error("Veri alınamadı:", error);
        loadingDiv.innerText = "Veriler alınırken bir hata oluştu.";
    } else {
        allShoots = data;
        processAndRenderData();
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
    fetchInitialData();
    
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
