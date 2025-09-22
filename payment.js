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
const markAllPaidBtn = document.getElementById('mark-all-paid-btn');
const pdfExportBtn = document.getElementById('pdf-export-btn');
const logoutBtn = document.getElementById('logout-btn');
const modalBackdrop = document.getElementById('modal-backdrop');
const modal = document.getElementById('additional-payment-modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('modal-form');
const modalAmount = document.getElementById('modal-amount');
const modalDescription = document.getElementById('modal-description');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// --- Global Değişkenler ---
let currentDate = new Date();
let paymentData = [];
let currentTeacherForModal = null;

// --- Yardımcı Fonksiyonlar ---
function HHMMToMinutes(timeStr) { if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) { return 0; } const [hours, minutes] = timeStr.split(':').map(Number); if (isNaN(hours) || isNaN(minutes)) { return 0; } return (hours * 60) + minutes; }
function minutesToHHMM(minutes) { if (isNaN(minutes) || minutes < 0) return '00:00'; const h = Math.floor(minutes / 60); const m = minutes % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

// --- Ana Fonksiyonlar ---
function getPaymentPeriod(date) { const currentDay = date.getDate(); const currentMonth = date.getMonth(); const currentYear = date.getFullYear(); let start, end; if (currentDay < 10) { end = new Date(currentYear, currentMonth, 9); start = new Date(currentYear, currentMonth - 1, 10); } else { start = new Date(currentYear, currentMonth, 10); end = new Date(currentYear, currentMonth + 1, 9); } return { start, end }; }

async function fetchAndRenderData() {
    loadingDiv.style.display = 'block';
    tableContainer.innerHTML = '';
    const period = getPaymentPeriod(currentDate);
    periodDisplay.textContent = `${period.start.toLocaleDateString('tr-TR')} - ${period.end.toLocaleDateString('tr-TR')}`;
    const periodForDB = { start: period.start.toISOString().split('T')[0], end: period.end.toISOString().split('T')[0] };

    const { data: logs, error: logsError } = await db.from('monitoring_logs').select('teacher_name, total_duration').gte('date', periodForDB.start).lte('date', periodForDB.end);
    const { data: teachers, error: teachersError } = await db.from('teachers').select('name, iban');
    const { data: additionalPayments, error: additionalPaymentsError } = await db.from('additional_payments').select('*').eq('payment_period_start', periodForDB.start);
    // Ödeme kayıtlarını yeni sütunla birlikte çek
    const { data: payments, error: paymentsError } = await db.from('payment_records').select('teacher_name, paid_duration_minutes, extra_time_paid').eq('payment_period_start', periodForDB.start);

    if (logsError || teachersError || additionalPaymentsError || paymentsError) { console.error(logsError || teachersError || additionalPaymentsError || paymentsError); return; }

    const teacherTotals = logs.reduce((acc, log) => { if (!acc[log.teacher_name]) { acc[log.teacher_name] = 0; } acc[log.teacher_name] += HHMMToMinutes(log.total_duration); return acc; }, {});
    const teacherMap = new Map(teachers.map(t => [t.name, t.iban]));
    const additionalPaymentMap = new Map(additionalPayments.map(p => [p.teacher_name, { amount: p.amount, description: p.description }]));
    const paymentMap = new Map(payments.map(p => [p.teacher_name, { paidMinutes: p.paid_duration_minutes, extraTimePaid: p.extra_time_paid }]));

    paymentData = Object.keys(teacherTotals).map(name => {
        const totalMinutes = teacherTotals[name] || 0;
        const paymentRecord = paymentMap.get(name) || { paidMinutes: 0, extraTimePaid: false };
        const additionalPayment = additionalPaymentMap.get(name) || { amount: 0, description: '' };

        const extraTimeMinutes = Math.max(0, totalMinutes - paymentRecord.paidMinutes);
        
        return {
            name,
            iban: teacherMap.get(name) || '-',
            totalMinutes,
            paidMinutes: paymentRecord.paidMinutes,
            extraTimeMinutes,
            isPaid: paymentRecord.paidMinutes > 0,
            isExtraTimePaid: paymentRecord.extraTimePaid,
            normalAmount: (paymentRecord.paidMinutes / 60) * 500,
            extraTimeAmount: (extraTimeMinutes / 60) * 500,
            additionalAmount: Number(additionalPayment.amount),
            additionalDescription: additionalPayment.description,
            totalAmount: ((totalMinutes / 60) * 500) + Number(additionalPayment.amount),
            isExcluded: false
        };
    }).sort((a,b) => a.name.localeCompare(b.name));
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
    tfoot.innerHTML = `<tr class="bg-gray-100 font-bold border-t-2 border-gray-300"><td class="px-6 py-4 text-right" colspan="5">Toplam Kayıt: ${totalTeacherCount} Öğretmen</td><td class="px-6 py-4" colspan="3">Genel Toplam Tutar: ${grandTotalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td></tr>`;
}

function renderTable() {
    if (paymentData.length === 0) { loadingDiv.style.display = 'none'; tableContainer.innerHTML = `<p class="text-center text-gray-500 py-8">Bu dönem için kayıt bulunmamaktadır.</p>`; return; }
    let tableHTML = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50"><tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Öğretmen</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Normal Ödeme</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ek Süre</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ek Ödeme</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Tutar</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dahil Etme</th>
            </tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">`;

    paymentData.forEach(teacher => {
        const rowClass = teacher.isExcluded ? 'excluded-row' : '';
        const excludeButtonText = teacher.isExcluded ? 'Dahil Et' : 'Dahil Etme';
        
        // Normal Ödeme Durumu
        let normalPaymentHTML = `<span class="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">Ödenmedi</span><br>${minutesToHHMM(teacher.totalMinutes)} / ${teacher.normalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`;
        if (teacher.isPaid) {
            normalPaymentHTML = `<span class="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Ödendi</span><br>${minutesToHHMM(teacher.paidMinutes)} / ${teacher.normalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`;
        }

        // Ek Süre Durumu
        let extraTimeHTML = `-`;
        if (teacher.extraTimeMinutes > 0) {
            extraTimeHTML = `<span class="${teacher.isExtraTimePaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} text-xs font-medium px-2 py-1 rounded-full">${teacher.isExtraTimePaid ? 'Ödendi' : 'Bekliyor'}</span><br>${minutesToHHMM(teacher.extraTimeMinutes)} / ${teacher.extraTimeAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`;
        }

        tableHTML += `
            <tr class="${rowClass}" data-teacher-name="${teacher.name}">
                <td class="px-6 py-4 whitespace-nowrap">${teacher.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${teacher.iban}</td>
                <td class="px-6 py-4 whitespace-nowrap">${normalPaymentHTML}</td>
                <td class="px-6 py-4 whitespace-nowrap">${extraTimeHTML}</td>
                <td class="px-6 py-4 whitespace-nowrap">${teacher.additionalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })} <br> <span class="text-xs text-gray-500">${teacher.additionalDescription || ''}</span></td>
                <td class="px-6 py-4 whitespace-nowrap font-semibold">${teacher.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td>
                <td class="px-6 py-4 whitespace-nowrap space-y-1">
                    ${!teacher.isPaid ? `<button class="pay-btn bg-green-500 text-white text-xs py-1 px-2 rounded w-full" data-teacher-name="${teacher.name}" data-pay-type="normal">Normal Öde</button>` : ''}
                    ${(teacher.extraTimeMinutes > 0 && !teacher.isExtraTimePaid) ? `<button class="pay-btn bg-yellow-500 text-white text-xs py-1 px-2 rounded w-full" data-teacher-name="${teacher.name}" data-pay-type="extra">Ek Süreyi Öde</button>` : ''}
                    <button class="add-payment-btn bg-blue-500 text-white text-xs py-1 px-2 rounded w-full" data-teacher-name="${teacher.name}">Ek Ödeme</button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap"><button class="exclude-btn ${teacher.isExcluded ? 'bg-blue-500' : 'bg-gray-500'} text-white text-sm py-1 px-3 rounded" data-teacher-name="${teacher.name}">${excludeButtonText}</button></td>
            </tr>`;
    });
    tableHTML += `</tbody><tfoot></tfoot></table>`;
    tableContainer.innerHTML = tableHTML;
    loadingDiv.style.display = 'none';
    renderTotals();
}

// --- Olay Dinleyicileri ---
tableContainer.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('exclude-btn')) { const teacherName = target.dataset.teacherName; const teacher = paymentData.find(p => p.name === teacherName); if (teacher) { teacher.isExcluded = !teacher.isExcluded; renderTable(); } }
    if (target.classList.contains('add-payment-btn')) { openModal(target.dataset.teacherName); }
    // Ödeme Butonu Mantığı
    if (target.classList.contains('pay-btn')) {
        const teacherName = target.dataset.teacherName;
        const payType = target.dataset.payType;
        handlePayment(teacherName, payType);
    }
});

async function handlePayment(teacherName, payType) {
    const teacher = paymentData.find(p => p.name === teacherName);
    const period = getPaymentPeriod(currentDate);

    let minutesToPay = 0;
    let newExtraTimeStatus = teacher.isExtraTimePaid;

    if (payType === 'normal') {
        minutesToPay = teacher.totalMinutes;
    } else if (payType === 'extra') {
        minutesToPay = teacher.totalMinutes; // Ödenen süre, toplam süreye eşitlenir.
        newExtraTimeStatus = true;
    }

    const { error } = await db.from('payment_records').upsert({
        payment_period_start: period.start.toISOString().split('T')[0],
        teacher_name: teacherName,
        paid_duration_minutes: minutesToPay,
        extra_time_paid: newExtraTimeStatus
    }, { onConflict: 'payment_period_start, teacher_name' });
    
    if (error) { Swal.fire('Hata!', 'Ödeme kaydedilemedi.', 'error'); }
    else { Swal.fire('Başarılı!', 'Ödeme kaydedildi.', 'success'); fetchAndRenderData(); }
}

// ... Diğer tüm fonksiyonlar (modal, dönem değiştirme vb.) aynı kalacak ...
function openModal(teacherName) { currentTeacherForModal = teacherName; const teacher = paymentData.find(p => p.name === teacherName); modalTitle.textContent = `${teacherName} - Ek Ödeme Ekle/Düzenle`; modalAmount.value = teacher.additionalAmount > 0 ? teacher.additionalAmount : ''; modalDescription.value = teacher.additionalDescription || ''; modal.style.display = 'block'; modalBackdrop.style.display = 'block'; }
function closeModal() { modal.style.display = 'none'; modalBackdrop.style.display = 'none'; modalForm.reset(); currentTeacherForModal = null; }
modalForm.addEventListener('submit', async (e) => { e.preventDefault(); const amount = Number(modalAmount.value); const description = modalDescription.value; const period = getPaymentPeriod(currentDate); const { error } = await db.from('additional_payments').upsert({ payment_period_start: period.start.toISOString().split('T')[0], teacher_name: currentTeacherForModal, amount: amount, description: description }, { onConflict: 'payment_period_start, teacher_name' }); if (error) { Swal.fire('Hata!', 'Ek ödeme kaydedilemedi.', 'error'); console.error(error); } else { Swal.fire('Başarılı!', 'Ek ödeme kaydedildi.', 'success'); closeModal(); fetchAndRenderData(); } });
modalCancelBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
prevMonthBtn.addEventListener('click', () => { currentDate.setDate(1); currentDate.setMonth(currentDate.getMonth() - 1); fetchAndRenderData(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setDate(15); currentDate.setMonth(currentDate.getMonth() + 1); fetchAndRenderData(); });
document.addEventListener('DOMContentLoaded', fetchAndRenderData);
