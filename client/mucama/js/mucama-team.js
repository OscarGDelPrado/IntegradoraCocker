/* ======================================
   MUCAMA-TEAM.JS - Vista Colaborativa Equipo con Offline
   Backend: GET /api/rooms - RoomController.getAllRooms()
   Filtra y agrupa por mucama en frontend
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, USER_ROLES, ROOM_STATUS } from '../../js/config.js';
import dbService from './db-service.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!api.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    const userData = api.getUserData();
    if (userData.role !== USER_ROLES.MAID) {
        window.location.href = '/index.html';
        return;
    }

    // Connectivity indicator
    updateConnectivityIndicator();
    window.addEventListener('online', () => {
        updateConnectivityIndicator();
        loadTeamRooms();
    });
    window.addEventListener('offline', updateConnectivityIndicator);

    await loadTeamRooms();

    // Auto-refresh cada 60 segundos (solo online)
    setInterval(() => {
        if (navigator.onLine) loadTeamRooms();
    }, 60000);
});

// Cargar todas las habitaciones y agrupar por mucama (con offline)
// Backend: RoomController.getAllRooms() - GET /api/rooms
async function loadTeamRooms() {
    try {
        const userData = api.getUserData();
        let allRooms;
        
        if (navigator.onLine) {
            allRooms = await api.get(ENDPOINTS.ROOMS);
            // Guardar en local para uso offline
            await dbService.saveRoomsLocal(allRooms);
        } else {
            // Usar cache local
            allRooms = await dbService.getRoomsLocal();
            showToast('📴 Modo offline - usando datos guardados', 'info');
        }

        // Filtrar solo habitaciones asignadas a mucamas (excluir la actual)
        const assignedRooms = allRooms.filter(room => 
            room.assignedTo && 
            room.assignedTo.id !== userData.userId &&
            room.assignedTo.role === USER_ROLES.MAID
        );

        // Agrupar por mucama
        const roomsByMaid = groupRoomsByMaid(assignedRooms);

        renderTeamView(roomsByMaid);

        if (Object.keys(roomsByMaid).length === 0) {
            document.getElementById('emptyState').classList.remove('d-none');
            document.getElementById('teamList').classList.add('d-none');
        } else {
            document.getElementById('emptyState').classList.add('d-none');
            document.getElementById('teamList').classList.remove('d-none');
        }

    } catch (error) {
        console.error('Error loading team rooms:', error);
        // Intentar cargar desde cache
        try {
            const cachedRooms = await dbService.getRoomsLocal();
            const userData = api.getUserData();
            const assignedRooms = cachedRooms.filter(room => 
                room.assignedTo && 
                room.assignedTo.id !== userData.userId &&
                room.assignedTo.role === USER_ROLES.MAID
            );
            const roomsByMaid = groupRoomsByMaid(assignedRooms);
            renderTeamView(roomsByMaid);
        } catch (e) {
            showToast('Error al cargar información del equipo', 'danger');
        }
    }
}

function groupRoomsByMaid(rooms) {
    const grouped = {};
    
    rooms.forEach(room => {
        const maidId = room.assignedTo.id;
        if (!grouped[maidId]) {
            grouped[maidId] = {
                maid: room.assignedTo,
                rooms: []
            };
        }
        grouped[maidId].rooms.push(room);
    });

    return grouped;
}

function renderTeamView(roomsByMaid) {
    const container = document.getElementById('teamList');
    
    const html = Object.values(roomsByMaid).map(({ maid, rooms }) => {
        const stats = calculateStats(rooms);
        
        return `
            <div class="maid-card">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div class="maid-name">${maid.name}</div>
                        <small class="text-muted">${maid.email || ''}</small>
                    </div>
                    <div class="text-end">
                        <div class="badge bg-success me-1">${stats.clean} ✓</div>
                        <div class="badge bg-warning text-dark me-1">${stats.dirty} ⚠</div>
                        <div class="badge bg-danger">${stats.occupied} 🚫</div>
                    </div>
                </div>
                
                <div class="mt-2">
                    <strong>Habitaciones (${rooms.length}):</strong>
                    <div class="mt-1">
                        ${rooms.map(room => `
                            <span class="room-chip status-${room.status}">
                                ${room.number}
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function calculateStats(rooms) {
    return {
        clean: rooms.filter(r => r.status === ROOM_STATUS.CLEAN).length,
        dirty: rooms.filter(r => r.status === ROOM_STATUS.DIRTY).length,
        occupied: rooms.filter(r => r.status === ROOM_STATUS.OCCUPIED).length
    };
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

function updateConnectivityIndicator() {
    const header = document.querySelector('.top-bar h3');
    if (!header) return;
    
    const existingBadge = header.querySelector('.connectivity-badge');
    if (existingBadge) existingBadge.remove();
    
    if (!navigator.onLine) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-warning text-dark ms-2 connectivity-badge';
        badge.textContent = '📴 Offline';
        header.appendChild(badge);
    }
}
