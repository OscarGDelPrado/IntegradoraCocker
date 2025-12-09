/* ======================================
   RECEPCION-ROOMS.JS - Gestión Habitaciones
   Backend: GET/POST/PUT/DELETE /api/rooms
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, ROOM_STATUS, USER_ROLES } from '../../js/config.js';

let allRooms = [];
let buildings = [];
let editingRoomId = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!api.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    const userData = api.getUserData();
    if (userData.role !== USER_ROLES.RECEPTION && userData.role !== USER_ROLES.ADMIN) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSidebar').textContent = userData.name;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        api.logout();
        window.location.href = '/index.html';
    });

    // Cargar datos
    await loadBuildings();
    await loadRooms();

    // Setup listeners
    setupFilters();
    setupNewRoomButton();
    setupRoomForm();
    setupDailyResetButton();
});

// Cargar edificios (necesario para el backend, aunque no hay BuildingController expuesto)
// En producción, habría GET /api/buildings
async function loadBuildings() {
    try {
        // Por ahora, extraer edificios únicos de las habitaciones
        const rooms = await api.get(ENDPOINTS.ROOMS);
        const buildingMap = new Map();
        
        rooms.forEach(room => {
            if (room.building) {
                buildingMap.set(room.building.id, room.building);
            }
        });

        buildings = Array.from(buildingMap.values());
        populateBuildingSelectors();
        
    } catch (error) {
        console.error('Error loading buildings:', error);
    }
}

function populateBuildingSelectors() {
    const selectors = ['filterBuilding', 'roomBuilding'];
    
    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        const currentValue = select.value;
        
        const options = buildings.map(b => 
            `<option value="${b.id}">${b.name}</option>`
        ).join('');
        
        if (selectorId === 'filterBuilding') {
            select.innerHTML = '<option value="">Todos los edificios</option>' + options;
        } else {
            select.innerHTML = '<option value="">Seleccione edificio</option>' + options;
        }
        
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Marcar habitaciones como bloqueadas si tienen incidencias activas
async function markBlockedRooms(rooms) {
    try {
        // Obtener todas las incidencias
        const incidents = await api.get(ENDPOINTS.INCIDENTS);
        
        // Crear set de IDs de habitaciones con incidencias activas
        const roomsWithActiveIncidents = new Set();
        incidents.filter(i => i.status === 'OPEN').forEach(incident => {
            if (incident.room && incident.room.id) {
                roomsWithActiveIncidents.add(incident.room.id);
            }
        });
        
        // Marcar habitaciones como bloqueadas
        return rooms.map(room => {
            if (roomsWithActiveIncidents.has(room.id)) {
                return { ...room, status: ROOM_STATUS.BLOCKED, originalStatus: room.status };
            }
            return room;
        });
    } catch (error) {
        console.error('Error obteniendo incidencias:', error);
        return rooms; // En caso de error, devolver habitaciones sin modificar
    }
}

// Cargar todas las habitaciones
// Backend: RoomController.getAllRooms() - GET /api/rooms
async function loadRooms() {
    try {
        let rooms = await api.get(ENDPOINTS.ROOMS);
        // Marcar habitaciones como bloqueadas si tienen incidencias activas
        rooms = await markBlockedRooms(rooms);
        allRooms = rooms;
        renderRooms(allRooms);
    } catch (error) {
        console.error('Error loading rooms:', error);
        showToast('Error al cargar habitaciones', 'danger');
    }
}

function renderRooms(rooms) {
    const tbody = document.getElementById('roomsTableBody');
    
    if (rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay habitaciones</td></tr>';
        return;
    }

    tbody.innerHTML = rooms.map(room => `
        <tr>
            <td><strong>${room.number}</strong></td>
            <td>${room.building?.name || 'N/A'}</td>
            <td>${room.floor}</td>
            <td><span class="room-status room-status-${room.status}">${getStatusText(room.status)}</span></td>
            <td>${room.assignedTo?.name || '<span class="text-muted">Sin asignar</span>'}</td>
            <td>${formatDate(room.updatedAt)}</td>
            <td>
                <button class="btn btn-sm btn-outline-info btn-action" onclick="reassignRoom(${room.id}, '${room.number}')" title="Reasignar mucama">
                    👤
                </button>
                <button class="btn btn-sm btn-outline-primary btn-action" onclick="editRoom(${room.id})">
                    Editar
                </button>
                <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteRoom(${room.id}, '${room.number}')">
                    Eliminar
                </button>
            </td>
        </tr>
    `).join('');
}

// Setup filtros
function setupFilters() {
    const searchInput = document.getElementById('searchRoom');
    const statusFilter = document.getElementById('filterStatus');
    const buildingFilter = document.getElementById('filterBuilding');
    const clearBtn = document.getElementById('clearFilters');

    const applyFilters = () => {
        let filtered = allRooms;

        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(r => 
                r.number.toLowerCase().includes(searchTerm) ||
                r.building?.name.toLowerCase().includes(searchTerm)
            );
        }

        const status = statusFilter.value;
        if (status) {
            filtered = filtered.filter(r => r.status === status);
        }

        const buildingId = buildingFilter.value;
        if (buildingId) {
            filtered = filtered.filter(r => r.building?.id == buildingId);
        }

        renderRooms(filtered);
    };

    searchInput.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    buildingFilter.addEventListener('change', applyFilters);

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        statusFilter.value = '';
        buildingFilter.value = '';
        renderRooms(allRooms);
    });
}

// Setup botón nueva habitación
function setupNewRoomButton() {
    document.getElementById('newRoomBtn').addEventListener('click', () => {
        editingRoomId = null;
        document.getElementById('roomModalTitle').textContent = 'Nueva Habitación';
        document.getElementById('roomForm').reset();
        document.getElementById('roomId').value = '';
        
        const modal = new bootstrap.Modal(document.getElementById('roomModal'));
        modal.show();
    });
}

// Editar habitación
window.editRoom = async (roomId) => {
    try {
        editingRoomId = roomId;
        const room = await api.get(ENDPOINTS.ROOM_BY_ID(roomId));
        
        document.getElementById('roomModalTitle').textContent = 'Editar Habitación';
        document.getElementById('roomId').value = room.id;
        document.getElementById('roomNumber').value = room.number;
        document.getElementById('roomBuilding').value = room.building?.id || '';
        document.getElementById('roomFloor').value = room.floor;
        document.getElementById('roomStatus').value = room.status;
        
        const modal = new bootstrap.Modal(document.getElementById('roomModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading room:', error);
        showToast('Error al cargar habitación', 'danger');
    }
};

// Setup formulario
function setupRoomForm() {
    document.getElementById('roomForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRoom();
    });
}

// Guardar habitación (crear o actualizar)
// Backend: POST /api/rooms o PUT /api/rooms/{id}
async function saveRoom() {
    try {
        const roomData = {
            number: document.getElementById('roomNumber').value,
            building: { id: parseInt(document.getElementById('roomBuilding').value) },
            floor: parseInt(document.getElementById('roomFloor').value),
            status: document.getElementById('roomStatus').value,
            active: true
        };

        if (editingRoomId) {
            // Actualizar - PUT /api/rooms/{id}
            const existingRoom = await api.get(ENDPOINTS.ROOM_BY_ID(editingRoomId));
            await api.put(ENDPOINTS.ROOM_BY_ID(editingRoomId), {
                ...existingRoom,
                ...roomData
            });
            showToast('Habitación actualizada', 'success');
        } else {
            // Crear - POST /api/rooms
            await api.post(ENDPOINTS.ROOMS, roomData);
            showToast('Habitación creada', 'success');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('roomModal'));
        modal.hide();

        await loadRooms();

    } catch (error) {
        console.error('Error saving room:', error);
        showToast('Error al guardar habitación', 'danger');
    }
}

// Eliminar habitación
// Backend: DELETE /api/rooms/{id}
window.deleteRoom = async (roomId, roomNumber) => {
    if (!confirm(`¿Eliminar habitación ${roomNumber}?`)) {
        return;
    }

    try {
        await api.delete(ENDPOINTS.ROOM_BY_ID(roomId));
        showToast('Habitación eliminada', 'success');
        await loadRooms();
    } catch (error) {
        console.error('Error deleting room:', error);
        showToast('Error al eliminar habitación', 'danger');
    }
};

// Helpers
function getStatusText(status) {
    const map = {
        [ROOM_STATUS.CLEAN]: 'Limpia',
        [ROOM_STATUS.DIRTY]: 'Sucia',
        [ROOM_STATUS.OCCUPIED]: 'Ocupada',
        [ROOM_STATUS.BLOCKED]: 'Bloqueada'
    };
    return map[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Setup botón de reinicio diario
function setupDailyResetButton() {
    document.getElementById('dailyResetBtn').addEventListener('click', async () => {
        if (!confirm('¿Marcar todas las habitaciones limpias como sucias?\n\nEsta acción simula el reinicio automático de las 8 AM.')) {
            return;
        }

        try {
            const response = await api.post(ENDPOINTS.ROOMS_RESET, {});
            showToast(`✅ ${response.message}`, 'success');
            await loadRooms();
        } catch (error) {
            console.error('Error en reinicio diario:', error);
            showToast('Error al ejecutar reinicio diario', 'danger');
        }
    });
}

// Reasignar habitación a otra mucama
window.reassignRoom = async (roomId, roomNumber) => {
    try {
        // Cargar lista de mucamas
        const allUsers = await api.get(ENDPOINTS.USERS);
        const maids = allUsers.filter(u => u.role === USER_ROLES.MAID);

        if (maids.length === 0) {
            showToast('No hay mucamas disponibles', 'warning');
            return;
        }

        // Crear selector de mucamas
        const options = [
            '<option value="">Sin asignar</option>',
            ...maids.map(m => `<option value="${m.id}">${m.name} - ${m.username}</option>`)
        ].join('');

        const result = await showSelectDialog(
            `Reasignar Habitación ${roomNumber}`,
            'Seleccione la nueva mucama asignada:',
            options
        );

        if (result === null) return; // Usuario canceló

        const maidId = result === '' ? null : parseInt(result);
        
        await api.patch(ENDPOINTS.ROOM_ASSIGN(roomId), { maidId });
        showToast(
            maidId ? 'Habitación reasignada correctamente' : 'Asignación eliminada',
            'success'
        );
        await loadRooms();

    } catch (error) {
        console.error('Error reasignando habitación:', error);
        showToast('Error al reasignar habitación', 'danger');
    }
};

// Helper: Mostrar diálogo con selector
function showSelectDialog(title, message, optionsHTML) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                        <select class="form-select" id="selectDialogValue">
                            ${optionsHTML}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="confirmSelect">Confirmar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        
        modal.querySelector('#confirmSelect').addEventListener('click', () => {
            const value = modal.querySelector('#selectDialogValue').value;
            bsModal.hide();
            resolve(value);
        });

        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            if (!modal.querySelector('#confirmSelect').dataset.clicked) {
                resolve(null);
            }
        });

        bsModal.show();
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}
