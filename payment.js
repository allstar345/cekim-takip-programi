// --- Supabase Client ---
const SUPABASE_URL = 'https://vpxwjehzdbyekpfborbc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweHdqZWh6ZGJ5ZWtwZmJvcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NDgwMzYsImV4cCI6MjA3MzMyNDAzNn0.nFKMdfFeoGOgjZAcAke4ZeHxAhH2FLLNfMzD-QLQd18';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DOM Elementleri ---
const loadingDiv = document.getElementById('loading');
const tableContainer = document.getElementById('payment-table-container');
const periodDisplay = document.getElementById('period-display');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const logoutBtn = document.getElementById('logout-btn');

// --- Global Değişkenler ---
let currentDate = new Date();
let paymentData = []; 

// --- Yardımcı Fonksiyonlar ---
function HHMMToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) { return 0; }
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) { return 0; }
    return (hours * 60) + minutes;
}

// --- Ana Fonksiyonlar ---
function getPaymentPeriod(date) {
    const currentDay = date.getDate();
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    let start, end;
    if (currentDay < 10) {
        end = new Date(currentYear, currentMonth, 9);
        start = new Date(currentYear, currentMonth - 1, 10);
    } else {
        start = new Date(currentYear, currentMonth, 10);
        end = new Date(currentYear, currentMonth + 1, 9);
    }
    return { start, end };
}

async function fetchAndRenderData() {
    loadingDiv.style.display = 'block';
    tableContainer.innerHTML = '';
    const period = getPaymentPeriod(currentDate);
    periodDisplay.textContent = `${period.start.toLocaleDateString('tr-TR')} - ${period.end.toLocaleDateString('tr-TR')}`;
    const periodForDB = { start: period.start.toISOString().split('T')[0], end: period.end.toISOString().split('T')[0] };

    const { data: logs, error: logsError } = await db.from('monitoring_logs').select('teacher_name, total_duration').gte('date', periodForDB.start).lte('date', periodForDB.end);
    const { data: teachers, error: teachersError } = await db.from('teachers').select('name, iban');
    if (logsError || teachersError) { console.error(logsError || teachersError); return; }

    const teacherTotals = logs.reduce((acc, log) => {
        if (!acc[log.teacher_name]) acc[log.teacher_name] = 0;
        acc[log.teacher_name] += HHMMToMinutes(log.total_duration);
        return acc;
    }, {});
    
    const teacherMap = new Map(teachers.map(t => [t.name, t.iban]));
    
    paymentData = Object.entries(teacherTotals).map(([name, totalMinutes]) => ({
        name,
        iban: teacherMap.get(name) || '-',
        totalMinutes,
        totalAmount: (totalMinutes / 60) * 500, // Saatlik ücret 500 TL
        isExcluded: false
    })).sort((a,b) => a.name.localeCompare(b.name));

    renderTable();
}

function renderTotals() {
    const includedTeachers = paymentData.filter(p => !p.isExcluded);
    const totalTeacherCount = includedTeachers.length;
    const grandTotalAmount = includedTeachers.reduce((sum, p) => sum + p.totalAmount, 0);
    const table = tableContainer.querySelector('table');
    if (!table) return;
    let tfoot = table.querySelector('tfoot');
    if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }
    tfoot.innerHTML = `
        <tr class="bg-gray-100 font-bold border-t-2 border-gray-300">
            <td class="px-6 py-4 text-right" colspan="3">Toplam Kayıt: ${totalTeacherCount} Öğretmen</td>
            <td class="px-6 py-4" colspan="2">Toplam Tutar: ${grandTotalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td>
        </tr>
    `;
}

function renderTable() {
    if (paymentData.length === 0) {
        tableContainer.innerHTML = `<p class="text-center text-gray-500 py-8">Bu dönem için kayıt bulunmamaktadır.</p>`;
        loadingDiv.style.display = 'none';
        return;
    }
    let tableHTML = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Öğretmen</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Süre</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Tutar</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">`;

    paymentData.forEach(teacher => {
        const durationHours = Math.floor(teacher.totalMinutes / 60);
        const durationMinutes = teacher.totalMinutes % 60;
        const durationString = `${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}`;
        const rowClass = teacher.isExcluded ? 'excluded-row' : '';
        const excludeButtonText = teacher.isExcluded ? 'Dahil Et' : 'Dahil Etme';
        const excludeButtonClass = teacher.isExcluded ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-600';
        tableHTML += `
            <tr class="${rowClass}" data-teacher-name="${teacher.name}">
                <td class="px-6 py-4 whitespace-nowrap">${teacher.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${teacher.iban}</td>
                <td class="px-6 py-4 whitespace-nowrap">${durationString}</td>
                <td class="px-6 py-4 whitespace-nowrap">${teacher.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button class="exclude-btn ${excludeButtonClass} text-white text-sm py-1 px-3 rounded" data-teacher-name="${teacher.name}">${excludeButtonText}</button>
                </td>
            </tr>`;
    });
    tableHTML += `</tbody><tfoot></tfoot></table>`;
    tableContainer.innerHTML = tableHTML;
    loadingDiv.style.display = 'none';
    renderTotals();
}

// --- Olay Dinleyicileri (Event Listeners) ---
tableContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('exclude-btn')) {
        const teacherName = e.target.dataset.teacherName;
        const teacher = paymentData.find(p => p.name === teacherName);
        if (teacher) {
            teacher.isExcluded = !teacher.isExcluded;
            renderTable();
        }
    }
});
prevMonthBtn.addEventListener('click', () => { currentDate.setDate(1); currentDate.setMonth(currentDate.getMonth() - 1); fetchAndRenderData(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setDate(15); currentDate.setMonth(currentDate.getMonth() + 1); fetchAndRenderData(); });
document.addEventListener('DOMContentLoaded', fetchAndRenderData);
