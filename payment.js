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

    if (!permissions.includes('admin') && !permissions.includes('view_odeme')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
    }
}
checkAuthAndPermissions();


// --- Sayfa İşlevselliği ---
const db = supabase.createClient(supabaseUrl, supabaseAnonKey);
const loadingDiv = document.getElementById('loading');
const tableContainer = document.getElementById('payment-table-container');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const periodDisplay = document.getElementById('period-display');
const markAllPaidBtn = document.getElementById('mark-all-paid-btn');
const markAllUnpaidBtn = document.getElementById('mark-all-unpaid-btn');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const logoutBtn = document.getElementById('logout-btn');

const HOURLY_RATE = 500;
let currentDate = new Date();
let teacherPaymentData = [];
let currentGrandTotalAmount = 0;

function toYYYYMMDD(date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function getPaymentPeriod(date) { let year = date.getFullYear(); let month = date.getMonth(); let endBoundary, start; if (date.getDate() >= 10) { endBoundary = new Date(year, month + 1, 10); } else { endBoundary = new Date(year, month, 10); } start = new Date(endBoundary.getFullYear(), endBoundary.getMonth() - 1, 10); let inclusiveEnd = new Date(endBoundary); inclusiveEnd.setDate(inclusiveEnd.getDate() - 1); return { start: toYYYYMMDD(start), end: toYYYYMMDD(inclusiveEnd) }; }
function HHMMToMinutes(timeStr) {
    // GÜVENLİK GÜNCELLEMESİ: Gelen verinin bir metin (string) olup olmadığını kontrol et
    if (typeof timeStr !== 'string' || !timeStr.includes(':')) {
        return 0; // Eğer metin değilse veya ':' içermiyorsa, hata vermeden 0 döndür.
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}
function minutesToHHMM(totalMinutes) { if (totalMinutes < 0) totalMinutes = 0; const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60; return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`; }

async function fetchAndRenderData() {
    loadingDiv.style.display = 'block';
    tableContainer.innerHTML = '';
    const period = getPaymentPeriod(currentDate);
    periodDisplay.textContent = `${new Date(period.start+'T00:00:00').toLocaleDateString('tr-TR')} - ${new Date(period.end+'T00:00:00').toLocaleDateString('tr-TR')}`;

    const { data: teacherIbanData, error: ibanError } = await db.from('teachers').select('name, iban');
    if (ibanError) {
        tableContainer.innerHTML = `<p class="text-red-500">IBAN verileri çekilirken hata oluştu.</p>`;
        console.error(ibanError);
        loadingDiv.style.display = 'none';
        return;
    }
    const ibanMap = Object.fromEntries(teacherIbanData.map(t => [t.name, t.iban]));

    const { data: logs, error: logsError } = await db.from('monitoring_logs').select('teacher_name, total_duration').gte('date', period.start).lte('date', period.end);
    const { data: payments, error: paymentsError } = await db.from('payment_records').select('id, teacher_name, paid_duration_minutes, paid_amount').eq('payment_period_start', period.start).eq('payment_period_end', period.end);

    if(logsError || paymentsError) { tableContainer.innerHTML = `<p class="text-red-500">Veri çekerken hata oluştu.</p>`; console.error(logsError || paymentsError); loadingDiv.style.display = 'none'; return; }

    const teacherData = {};
    logs.forEach(log => { const name = log.teacher_name; if (!teacherData[name]) { teacherData[name] = { currentTotalMinutes: 0, paidRecords: [] }; } teacherData[name].currentTotalMinutes += HHMMToMinutes(log.total_duration); });
    payments.forEach(payment => { const name = payment.teacher_name; if (!teacherData[name]) { teacherData[name] = { currentTotalMinutes: 0, paidRecords: [] }; } teacherData[name].paidRecords.push({ id: payment.id, minutes: payment.paid_duration_minutes, amount: payment.paid_amount }); });

    const sortedTeachers = Object.keys(teacherData).filter(name => teacherData[name].currentTotalMinutes > 0).sort((a, b) => a.localeCompare(b, 'tr'));

    teacherPaymentData = [];
    let totalTeacherCount = sortedTeachers.length;
    let grandTotalMinutes = 0;
    let tableHTML = `<table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Öğretmen</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IBAN</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Süre</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Tutar</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

    if (sortedTeachers.length === 0) { tableHTML += `<tr><td colspan="6" class="text-center p-4 text-gray-500">Bu dönem için kayıt bulunamadı.</td></tr>`; }

    sortedTeachers.forEach(name => {
        const data = teacherData[name];
        grandTotalMinutes += data.currentTotalMinutes;
        const paidTotalMinutes = data.paidRecords.reduce((sum, record) => sum + record.minutes, 0);
        const dueMinutes = data.currentTotalMinutes - paidTotalMinutes;
        const totalDurationHHMM = minutesToHHMM(data.currentTotalMinutes);
        const totalAmount = (data.currentTotalMinutes / 60) * HOURLY_RATE;
        const iban = ibanMap[name] || 'Tanımsız';
        teacherPaymentData.push({ name: name, iban: iban, amount: totalAmount });
        let statusHTML = '<div class="flex flex-col space-y-2">';
        data.paidRecords.forEach(record => { statusHTML += `<div class="flex items-center justify-between p-1 bg-green-100 rounded-md"><span class="text-sm font-semibold text-green-800">Ödendi (${minutesToHHMM(record.minutes)})</span><button class="cancel-payment-btn text-red-600 hover:text-red-900 text-xs font-bold ml-2 p-1" data-payment-id="${record.id}">İptal Et</button></div>`; });
        if (dueMinutes > 0) { const dueAmount = (dueMinutes / 60) * HOURLY_RATE; statusHTML += `<div class="flex items-center justify-between p-1 bg-red-100 rounded-md"><span class="text-sm font-semibold text-red-800">${paidTotalMinutes > 0 ? 'Ek Ödeme' : 'Ödenmedi'} (${minutesToHHMM(dueMinutes)})</span><select class="payment-status-select bg-red-200 text-red-800 rounded-lg p-1 border-red-300 text-xs ml-2" data-teacher-name="${name}" data-due-minutes="${dueMinutes}" data-due-amount="${dueAmount}"><option value="unpaid" selected>Öde</option><option value="paid">Onayla</option></select></div>`; }
        statusHTML += '</div>';
        const actionHTML = `<button class="exclude-btn bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded-lg transition-colors" data-amount="${totalAmount}">Dahil Etme</button>`;
        tableHTML += `<tr><td class="px-6 py-4 font-medium">${name}</td><td class="px-6 py-4 text-sm text-gray-600">${iban}</td><td class="px-6 py-4">${totalDurationHHMM}</td><td class="px-6 py-4">${totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td><td class="px-6 py-4">${statusHTML}</td><td class="px-6 py-4">${actionHTML}</td></tr>`;
    });

    const grandTotalAmount = (grandTotalMinutes / 60) * HOURLY_RATE;
    currentGrandTotalAmount = grandTotalAmount;
    tableHTML += `</tbody><tfoot class="bg-gray-100 font-bold"><tr class="border-t-2 border-gray-300"><td class="px-6 py-3 text-right" colspan="4">Toplam Kayıt: ${totalTeacherCount} Öğretmen</td><td class="px-6 py-3" colspan="2">Toplam Tutar: <span id="grand-total-amount">${grandTotalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span></td></tr></tfoot></table>`;
    tableContainer.innerHTML = tableHTML;
    loadingDiv.style.display = 'none';
}

async function downloadPaymentPDF() {
    const downloadButton = document.getElementById('download-pdf-btn');
    downloadButton.disabled = true;
    downloadButton.textContent = 'PDF Oluşturuluyor...';
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.width = '800px';
    pdfContainer.style.padding = '20px';
    pdfContainer.style.backgroundColor = 'white';
    pdfContainer.style.fontFamily = "'Inter', sans-serif";
    const period = getPaymentPeriod(currentDate);
    const periodText = `${new Date(period.start+'T00:00:00').toLocaleDateString('tr-TR')} - ${new Date(period.end+'T00:00:00').toLocaleDateString('tr-TR')} Dönemi Ödeme Listesi`;
    let pdfHTML = `<h2 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px;">${periodText}</h2>`;
    pdfHTML += `<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead style="background-color: #f3f4f6;"><tr><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Öğretmen Adı</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">IBAN</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ücret</th></tr></thead><tbody>`;
    teacherPaymentData.forEach(item => { pdfHTML += `<tr><td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.iban}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</td></tr>`; });
    pdfHTML += `</tbody></table>`;
    pdfContainer.innerHTML = pdfHTML;
    document.body.appendChild(pdfContainer);

    html2canvas(pdfContainer, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`odeme_listesi_${period.start}_${period.end}.pdf`);
    }).finally(() => {
        document.body.removeChild(pdfContainer);
        downloadButton.disabled = false;
        downloadButton.textContent = 'PDF Olarak İndir';
    });
}

async function markAllAsUnpaid() { const period = getPaymentPeriod(currentDate); if (!confirm(`Bu dönemdeki (${periodDisplay.textContent}) tüm ödeme kayıtlarını silmek istediğinizden emin misiniz?`)) return; const { error } = await db.from('payment_records').delete().eq('payment_period_start', period.start).eq('payment_period_end', period.end); if (error) { alert('Toplu ödeme iptali sırasında bir hata oluştu!'); console.error(error); } else { fetchAndRenderData(); } }
async function handlePayment(teacherName, dueMinutes, dueAmount) { const period = getPaymentPeriod(currentDate); const { error } = await db.from('payment_records').insert([{ teacher_name: teacherName, payment_period_start: period.start, payment_period_end: period.end, paid_duration_minutes: dueMinutes, paid_amount: dueAmount }]); if (error) { alert('Ödeme kaydedilirken bir hata oluştu!'); console.error(error); } else { fetchAndRenderData(); } }
async function handleCancelPayment(paymentId) { if (!confirm('Bu ödeme kaydını silmek istediğinizden emin misiniz?')) return; const { error } = await db.from('payment_records').delete().eq('id', paymentId); if (error) { alert('Ödeme iptal edilirken bir hata oluştu!'); console.error(error); } else { fetchAndRenderData(); } }

tableContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('cancel-payment-btn')) {
        const paymentId = e.target.dataset.paymentId;
        handleCancelPayment(paymentId);
    }
    if (e.target.classList.contains('exclude-btn')) {
        const button = e.target;
        const row = button.closest('tr');
        const amount = parseFloat(button.dataset.amount);
        const grandTotalSpan = document.getElementById('grand-total-amount');

        if (row.classList.contains('excluded')) {
            currentGrandTotalAmount += amount;
            row.classList.remove('excluded');
            row.style.textDecoration = '';
            row.style.opacity = '1';
            button.textContent = 'Dahil Etme';
            button.classList.replace('bg-green-500', 'bg-yellow-500');
            button.classList.replace('hover:bg-green-600', 'hover:bg-yellow-600');
        } else {
            currentGrandTotalAmount -= amount;
            row.classList.add('excluded');
            row.style.textDecoration = 'line-through';
            row.style.opacity = '0.5';
            button.textContent = 'Dahil Et';
            button.classList.replace('bg-yellow-500', 'bg-green-500');
            button.classList.replace('hover:bg-yellow-600', 'hover:bg-green-600');
        }
        grandTotalSpan.textContent = currentGrandTotalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    }
});

tableContainer.addEventListener('change', (e) => { if (e.target.classList.contains('payment-status-select') && e.target.value === 'paid') { const select = e.target; const { teacherName, dueMinutes, dueAmount } = select.dataset; select.disabled = true; handlePayment(teacherName, parseInt(dueMinutes), parseFloat(dueAmount)); } });
markAllPaidBtn.addEventListener('click', async () => { const selects = document.querySelectorAll('.payment-status-select'); const paymentsToInsert = []; const period = getPaymentPeriod(currentDate); selects.forEach(select => { const { teacherName, dueMinutes, dueAmount } = select.dataset; paymentsToInsert.push({ teacher_name: teacherName, payment_period_start: period.start, payment_period_end: period.end, paid_duration_minutes: parseInt(dueMinutes), paid_amount: parseFloat(dueAmount) }); }); if(paymentsToInsert.length === 0) { alert('Ödenecek kayıt bulunmamaktadır.'); return; } const { error } = await db.from('payment_records').insert(paymentsToInsert); if (error) { alert('Toplu ödeme kaydedilirken bir hata oluştu!'); console.error(error); } else { fetchAndRenderData(); } });

prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); fetchAndRenderData(); });
nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); fetchAndRenderData(); });
downloadPdfBtn.addEventListener('click', downloadPaymentPDF);
markAllUnpaidBtn.addEventListener('click', markAllAsUnpaid);

logoutBtn.addEventListener('click', async () => {
    const mainStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key), setItem: (key, value) => { localStorage.setItem(key, value); sessionStorage.setItem(key, value); }, removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); }, };
    const supabase_logout = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: mainStorageAdapter } });
    await supabase_logout.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', fetchAndRenderData);
