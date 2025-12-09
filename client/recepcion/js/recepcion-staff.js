/* ======================================
   RECEPCION-STAFF.JS - Gestión de Personal
   Backend: GET/POST/PUT/DELETE /api/users
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, USER_ROLES } from '../../js/config.js';

let allUsers = [];
let editingUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!api.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    const userData = api.getUserData();
    if (userData.role !== USER_ROLES.ADMIN && userData.role !== USER_ROLES.RECEPTION) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSidebar').textContent = userData.name;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        api.logout();
        window.location.href = '/index.html';
    });

    // Cargar usuarios
    await loadUsers();

    // Setup listeners
    setupNewUserButton();
    setupFormSubmit();
    setupFilters();
});

// Cargar todos los usuarios
async function loadUsers() {
    try {
        allUsers = await api.get(ENDPOINTS.USERS);
        renderUsers(allUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Error al cargar usuarios', 'danger');
    }
}

// Renderizar tabla de usuarios
function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    No hay usuarios registrados
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>
                <strong>${user.name}</strong><br>
                <small class="text-muted">${user.username}</small>
            </td>
            <td>${user.email || 'N/A'}</td>
            <td>
                <span class="badge ${getRoleBadgeClass(user.role)}">
                    ${getRoleText(user.role)}
                </span>
            </td>
            <td>
                <span class="badge ${user.active ? 'bg-success' : 'bg-secondary'}">
                    ${user.active ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editUser(${user.id})" 
                            title="Editar">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                    </button>
                    <button class="btn btn-outline-${user.active ? 'warning' : 'success'}" 
                            onclick="toggleUserStatus(${user.id}, ${!user.active})"
                            title="${user.active ? 'Desactivar' : 'Activar'}">
                        ${user.active ? '🚫' : '✅'}
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteUser(${user.id})" 
                            title="Eliminar">
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Setup botón nuevo usuario
function setupNewUserButton() {
    document.getElementById('newUserBtn').addEventListener('click', () => {
        editingUserId = null;
        document.getElementById('userModalTitle').textContent = 'Nuevo Usuario';
        document.getElementById('userForm').reset();
        
        // Mostrar y hacer requerido el password para nuevo usuario
        const passwordInput = document.getElementById('userPassword');
        const passwordGroup = document.getElementById('passwordGroup');
        passwordGroup.classList.remove('d-none');
        passwordInput.setAttribute('required', 'required');
        passwordInput.placeholder = 'Mínimo 4 caracteres';
        
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    });
}

// Editar usuario
window.editUser = async (userId) => {
    try {
        const user = await api.get(ENDPOINTS.USER_BY_ID(userId));
        
        editingUserId = userId;
        document.getElementById('userModalTitle').textContent = 'Editar Usuario';
        document.getElementById('userName').value = user.name;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userEmail').value = user.email || '';
        document.getElementById('userRole').value = user.role;
        
        // Limpiar password y quitar required
        const passwordInput = document.getElementById('userPassword');
        passwordInput.value = '';
        passwordInput.removeAttribute('required');
        
        // Mostrar campo password con placeholder indicando que es opcional
        const passwordGroup = document.getElementById('passwordGroup');
        passwordGroup.classList.remove('d-none');
        passwordInput.placeholder = 'Dejar vacío para no cambiar';
        
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Error al cargar usuario', 'danger');
    }
};

// Setup form submit
function setupFormSubmit() {
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });
}

// Guardar usuario (crear o actualizar)
async function saveUser() {
    try {
        const passwordValue = document.getElementById('userPassword').value.trim();
        
        const userData = {
            name: document.getElementById('userName').value.trim(),
            username: document.getElementById('userUsername').value.trim(),
            email: document.getElementById('userEmail').value.trim(),
            role: document.getElementById('userRole').value
        };

        // Validaciones frontend
        if (!userData.name || !userData.username || !userData.role) {
            showToast('Complete todos los campos requeridos', 'warning');
            return;
        }

        // Validar username (sin espacios, caracteres especiales básicos)
        if (!/^[a-zA-Z0-9_.-]+$/.test(userData.username)) {
            showToast('Username solo puede contener letras, números, guiones y puntos', 'warning');
            return;
        }

        // Validar email si se proporciona
        if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
            showToast('Email inválido', 'warning');
            return;
        }

        if (editingUserId) {
            // Actualizar usuario existente
            // Solo incluir password si se proporcionó uno nuevo
            if (passwordValue) {
                if (passwordValue.length < 4) {
                    showToast('La contraseña debe tener al menos 4 caracteres', 'warning');
                    return;
                }
                userData.password = passwordValue;
            }
            // No incluir password si está vacío (no se enviará al backend)
            
            const response = await api.put(ENDPOINTS.USER_BY_ID(editingUserId), userData);
            showToast('Usuario actualizado correctamente', 'success');
        } else {
            // Crear nuevo usuario - password es obligatorio
            if (!passwordValue || passwordValue.length < 4) {
                showToast('La contraseña es requerida y debe tener al menos 4 caracteres', 'warning');
                return;
            }
            userData.password = passwordValue;
            
            const response = await api.post(ENDPOINTS.USERS, userData);
            showToast('Usuario creado correctamente', 'success');
        }

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        modal.hide();

        // Recargar tabla
        await loadUsers();

    } catch (error) {
        console.error('Error saving user:', error);
        
        // Intentar extraer mensaje del error
        let errorMessage = 'Error al guardar usuario';
        
        if (error.response) {
            // El servidor respondió con un error
            errorMessage = typeof error.response === 'string' ? error.response : 'Datos inválidos';
        } else if (error.message) {
            if (error.message.includes('400')) {
                errorMessage = 'Verifique los datos ingresados';
            } else if (error.message.includes('409')) {
                errorMessage = 'Username ya existe';
            } else if (error.message.includes('500')) {
                errorMessage = 'Error en el servidor';
            }
        }
        
        showToast(errorMessage, 'danger');
    }
}

// Activar/desactivar usuario
window.toggleUserStatus = async (userId, newStatus) => {
    try {
        // Buscar el usuario para verificar su rol
        const user = allUsers.find(u => u.id === userId);
        
        if (user && user.role === USER_ROLES.ADMIN && !newStatus) {
            showToast('No se puede desactivar un usuario administrador', 'warning');
            return;
        }
        
        await api.patch(ENDPOINTS.USER_ACTIVATE(userId), newStatus);
        showToast(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`, 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error toggling user status:', error);
        
        let errorMessage = 'Error al cambiar estado';
        if (error.response && typeof error.response === 'string') {
            errorMessage = error.response;
        }
        
        showToast(errorMessage, 'danger');
    }
};

// Eliminar usuario (soft delete)
window.deleteUser = async (userId) => {
    try {
        // Buscar el usuario para verificar su rol
        const user = allUsers.find(u => u.id === userId);
        
        if (user && user.role === USER_ROLES.ADMIN) {
            showToast('No se puede eliminar un usuario administrador', 'warning');
            return;
        }
        
        if (!confirm(`¿Está seguro de eliminar al usuario ${user ? user.name : ''}?`)) return;
        
        await api.delete(ENDPOINTS.USER_BY_ID(userId));
        showToast('Usuario eliminado correctamente', 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        
        let errorMessage = 'Error al eliminar usuario';
        if (error.response && typeof error.response === 'string') {
            errorMessage = error.response;
        }
        
        showToast(errorMessage, 'danger');
    }
};

// Setup filtros
function setupFilters() {
    const filterRole = document.getElementById('filterRole');
    const filterStatus = document.getElementById('filterStatus');
    const searchInput = document.getElementById('searchUser');

    filterRole.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);
}

function applyFilters() {
    const role = document.getElementById('filterRole').value;
    const status = document.getElementById('filterStatus').value;
    const search = document.getElementById('searchUser').value.toLowerCase();

    let filtered = allUsers;

    // Filtrar por rol
    if (role) {
        filtered = filtered.filter(u => u.role === role);
    }

    // Filtrar por estado
    if (status === 'active') {
        filtered = filtered.filter(u => u.active === true);
    } else if (status === 'inactive') {
        filtered = filtered.filter(u => u.active === false);
    }

    // Filtrar por búsqueda
    if (search) {
        filtered = filtered.filter(u => 
            u.name.toLowerCase().includes(search) ||
            u.username.toLowerCase().includes(search) ||
            (u.email && u.email.toLowerCase().includes(search))
        );
    }

    renderUsers(filtered);
}

// Helpers
function getRoleText(role) {
    const roles = {
        [USER_ROLES.ADMIN]: 'Administrador',
        [USER_ROLES.RECEPTION]: 'Recepción',
        [USER_ROLES.MAID]: 'Mucama'
    };
    return roles[role] || role;
}

function getRoleBadgeClass(role) {
    const classes = {
        [USER_ROLES.ADMIN]: 'bg-danger',
        [USER_ROLES.RECEPTION]: 'bg-primary',
        [USER_ROLES.MAID]: 'bg-success'
    };
    return classes[role] || 'bg-secondary';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}
