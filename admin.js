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

    try {
        const { data, error } = await supabase.functions.invoke('list-users');
        if (error) throw error;

        renderUserTable(data.users);
        loadingDiv.style.display = 'none';
        tableContainer.style.display = 'block';
    } catch (error) {
        loadingDiv.innerHTML = `<p class="text-red-500">Kullanıcılar yüklenirken hata oluştu: ${error.message}</p>`;
    }
}

// 3. ADIM: Gelen kullanıcı verisiyle tabloyu oluştur
function renderUserTable(users) {
    userListBody.innerHTML = '';
    users.forEach(user => {
        const permissions = user.user_metadata?.permissions || [];
        const tr = document.createElement('tr');
        tr.setAttribute('data-user-id', user.id);

        let checkboxesHTML = '';
        ALL_PERMISSIONS.forEach(perm => {
            checkboxesHTML += `
                <td class="px-6 py-4 text-center">
                    <input type="checkbox" class="permission-cb h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-permission="${perm}" 
                           ${permissions.includes(perm) ? 'checked' : ''}>
                </td>
            `;
        });

        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900">${user.user_metadata?.full_name || 'İsim Yok'}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${user.email}</td>
            ${checkboxesHTML}
            <td class="px-6 py-4">
                <button class="save-btn bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>Kaydet</button>
            </td>
        `;
        userListBody.appendChild(tr);
    });
}

// 4. ADIM: Yetki değişikliklerini kaydetmek için olay dinleyicileri
userListBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('permission-cb')) {
        // Bir checkbox değiştiğinde, ilgili satırdaki 'Kaydet' butonunu aktif et
        const saveButton = e.target.closest('tr').querySelector('.save-btn');
        saveButton.disabled = false;
        saveButton.textContent = 'Kaydet!';
    }
});

userListBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('save-btn')) {
        const saveButton = e.target;
        const userRow = saveButton.closest('tr');
        const userIdToUpdate = userRow.dataset.userId;
        
        // Satırdaki tüm checkbox'ları bul ve işaretli olanların yetki adını al
        const newPermissions = [];
        userRow.querySelectorAll('.permission-cb:checked').forEach(cb => {
            newPermissions.push(cb.dataset.permission);
        });

        saveButton.disabled = true;
        saveButton.textContent = 'Kaydediliyor...';

        try {
            const { error } = await supabase.functions.invoke('update-user-permissions', {
                body: { userIdToUpdate, newPermissions }
            });

            if (error) throw error;
            
            Swal.fire('Başarılı!', 'Yetkiler güncellendi.', 'success');
            saveButton.textContent = 'Kaydet'; // Butonu eski haline getir
        } catch (error) {
            console.error('Yetki güncelleme hatası:', error);
            Swal.fire('Hata!', `Yetkiler güncellenemedi: ${error.message}`, 'error');
            saveButton.disabled = false; // Hata olursa butonu tekrar aktif et
            saveButton.textContent = 'Kaydet!';
        }
    }
});

// Sayfa yüklendiğinde kullanıcıları getir
document.addEventListener('DOMContentLoaded', fetchUsers);
