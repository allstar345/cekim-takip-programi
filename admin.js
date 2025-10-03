import { supabaseUrl, supabaseAnonKey } from './config.js';

const authStorageAdapter = { getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key) };
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: authStorageAdapter } });

const loadingDiv = document.getElementById('loading-users');
const tableContainer = document.getElementById('user-table-container');
const userListBody = document.getElementById('user-list-body');

const ALL_PERMISSIONS = ['view_cekim', 'view_izleme', 'view_odeme', 'admin'];

// 1. ADIM: Sayfaya sadece adminlerin girmesini sağla
async function checkAdminPermission() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.user_metadata?.permissions?.includes('admin')) {
        alert('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
        window.location.href = 'dashboard.html';
        return false;
    }
    return true;
}

// 2. ADIM: Supabase Fonksiyonunu çağırarak tüm kullanıcıları getir
async function fetchUsers() {
    const isAdmin = await checkAdminPermission();
    if (!isAdmin) return;

    loadingDiv.style.display = 'block';
    tableContainer.style.display = 'none';

    const { data, error } = await supabase.functions.invoke('list-users');

    if (error) {
        loadingDiv.innerHTML = `<p class="text-red-500">Kullanıcılar yüklenirken hata oluştu: ${error.message}</p>`;
        return;
    }

    renderUserTable(data.users);
    loadingDiv.style.display = 'none';
    tableContainer.style.display = 'block';
}

// 3. ADIM: Gelen kullanıcı verisiyle tabloyu oluştur
function renderUserTable(users) {
    userListBody.innerHTML = '';
    users.forEach(user => {
        const permissions = user.user_metadata.permissions || [];
        const tr = document.createElement('tr');
        tr.setAttribute('data-user-id', user.id);

        let checkboxesHTML = '';
        ALL_PERMISSIONS.forEach(perm => {
            checkboxesHTML += `
                <td class="px-6 py-4 text-center">
                    <input type="checkbox" class="permission-cb" data-permission="${perm}" 
                           ${permissions.includes(perm) ? 'checked' : ''}>
                </td>
            `;
        });

        tr.innerHTML = `
            <td class="px-6 py-4 font-medium">${user.user_metadata.full_name || ''}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${user.email}</td>
            ${checkboxesHTML}
            <td class="px-6 py-4">
                <button class="save-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600" disabled>Kaydet</button>
            </td>
        `;
        userListBody.appendChild(tr);
    });
}

// 4. ADIM (Sonraki aşamada yapılacak): Kaydet butonuna basıldığında yetkileri güncelleme
// Şimdilik bu kısmı boş bırakıyoruz.

// Sayfa yüklendiğinde kullanıcıları getir
document.addEventListener('DOMContentLoaded', fetchUsers);
