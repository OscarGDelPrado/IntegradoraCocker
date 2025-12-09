/* ======================================
   MUCAMA-HOME.JS - Dashboard Mucama CON OFFLINE + WEBSOCKET
   Backend: GET /api/rooms/maid/{maidId}
            PATCH /api/rooms/{id}/status
   Offline: PouchDB local storage + sync queue
   WebSocket: Notificaciones en tiempo real
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, ROOM_STATUS, USER_ROLES } from '../../js/config.js';
import dbService from './db-service.js';
import wsClient from '../../js/websocket-client.js';

let currentRooms = [];
let currentRoomId = null;
let isOfflineMode = !navigator.onLine;
let wsSubscriptions = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticación y rol
    if (!api.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    const userData = api.getUserData();
    if (userData.role !== USER_ROLES.MAID) {
        window.location.href = '/index.html';
        return;
    }

    // Mostrar nombre de usuario
    document.getElementById('userNameBadge').textContent = userData.name;

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        api.logout();
        window.location.href = '/index.html';
    });

    // Mostrar indicador de conectividad
    updateConnectivityIndicator();
    
    // Eventos de conectividad
    window.addEventListener('online', () => {
        console.log('🌐 Conexión detectada');
        isOfflineMode = false;
        updateConnectivityIndicator();
        loadMyRooms();
    });
    
    window.addEventListener('offline', () => {
        console.log('📵 Sin conexión detectada');
        isOfflineMode = true;
        updateConnectivityIndicator();
    });
    
    // Verificar conectividad real al enfocar la página
    window.addEventListener('focus', () => {
        const wasOffline = isOfflineMode;
        isOfflineMode = !navigator.onLine;
        
        if (wasOffline !== isOfflineMode) {
            updateConnectivityIndicator();
            if (!isOfflineMode) {
                loadMyRooms();
            }
        }
    });

    // Cargar habitaciones asignadas primero
    await loadMyRooms();

    // Event listeners para cambiar estado
    setupStatusButtons();

    // Verificar si hay una habitación pendiente de abrir (desde QR scan)
    // Debe ejecutarse DESPUÉS de cargar habitaciones
    await checkPendingRoomOpen();

    // Conectar WebSocket para notificaciones en tiempo real (con manejo de errores)
    if (navigator.onLine) {
        try {
            setupWebSocket();
        } catch (error) {
            console.warn('No se pudo conectar WebSocket (backend no disponible):', error);
        }
    }

    // Actualizar cada 30 segundos (solo si no hay WebSocket)
    setInterval(() => {
        if (navigator.onLine && !wsClient.isConnected()) {
            loadMyRooms();
        }
    }, 30000);
});

// Cargar habitaciones asignadas a esta mucama (con soporte offline)
// Backend: RoomController.getRoomsByMaid() - GET /api/rooms/maid/{maidId}
// Offline: Lee desde PouchDB local
async function loadMyRooms() {
    try {
        const userData = api.getUserData();
        let rooms;
        let incidents = [];

        if (navigator.onLine) {
            // ONLINE: Obtener del backend
            try {
                // Cargar habitaciones e incidencias en paralelo
                [rooms, incidents] = await Promise.all([
                    api.get(ENDPOINTS.ROOMS_BY_MAID(userData.userId)),
                    api.get(ENDPOINTS.INCIDENTS_BY_MAID(userData.userId))
                ]);
                // Guardar en PouchDB para uso offline
                await dbService.saveRoomsLocal(rooms);
                await dbService.saveIncidentsLocal(incidents);
            } catch (error) {
                console.warn('Error cargando del backend, usando datos locales:', error);
                rooms = await dbService.getRoomsLocal(userData.userId);
                incidents = await dbService.getIncidentsLocal();
            }
        } else {
            // OFFLINE: Obtener de PouchDB
            console.log('📵 Modo offline: Cargando datos locales');
            rooms = await dbService.getRoomsLocal(userData.userId);
            incidents = await dbService.getIncidentsLocal();
        }
        
        // Marcar habitaciones como bloqueadas si tienen incidencias activas
        rooms = markBlockedRooms(rooms, incidents);
        
        currentRooms = rooms;
        renderRooms(rooms);
        updateStats(rooms);

        // Filtrar habitaciones pendientes (no limpias) para mostrar empty state
        const pendingRooms = rooms.filter(room => room.status !== ROOM_STATUS.CLEAN);
        
        // Ocultar/mostrar empty state
        if (pendingRooms.length === 0) {
            document.getElementById('emptyState').classList.remove('d-none');
            document.getElementById('roomsList').classList.add('d-none');
        } else {
            document.getElementById('emptyState').classList.add('d-none');
            document.getElementById('roomsList').classList.remove('d-none');
        }

    } catch (error) {
        console.error('Error loading rooms:', error);
        showToast('Error al cargar habitaciones', 'danger');
    }
}

// Renderizar lista de habitaciones
function renderRooms(rooms) {
    const container = document.getElementById('roomsList');
    
    // Filtrar solo habitaciones que NO están limpias (DIRTY u OCCUPIED)
    const pendingRooms = rooms.filter(room => room.status !== ROOM_STATUS.CLEAN);
    
    if (pendingRooms.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = pendingRooms.map(room => `
        <div class="room-card" onclick="openRoomModal(${room.id}, '${room.number}')">
            <span class="room-status-badge status-${room.status}">
                ${getStatusText(room.status)}
            </span>
            <div class="room-number">Hab. ${room.number}</div>
            <div class="room-building text-muted">
                ${room.building?.name || 'Sin edificio'} - Piso ${room.floor}
            </div>
            <div class="mt-2">
                <small class="text-muted">
                    Actualizado: ${formatDate(room.updatedAt)}
                </small>
            </div>
        </div>
    `).join('');
}

// Marcar habitaciones como bloqueadas si tienen incidencias activas
function markBlockedRooms(rooms, incidents) {
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
}

// Actualizar estadísticas
function updateStats(rooms) {
    const clean = rooms.filter(r => r.status === ROOM_STATUS.CLEAN).length;
    const dirty = rooms.filter(r => r.status === ROOM_STATUS.DIRTY).length;
    const blocked = rooms.filter(r => r.status === ROOM_STATUS.BLOCKED).length;

    document.getElementById('cleanCount').textContent = clean;
    document.getElementById('dirtyCount').textContent = dirty;
    document.getElementById('occupiedCount').textContent = blocked;
}

// Abrir modal para cambiar estado
window.openRoomModal = async (roomId, roomNumber) => {
    currentRoomId = roomId;
    
    // Buscar la habitación en el listado actual
    let room = currentRooms.find(r => r.id === roomId);
    
    // Si no está en el listado (habitación no asignada), obtener del backend
    if (!room && navigator.onLine) {
        try {
            room = await api.get(ENDPOINTS.ROOM_BY_ID(roomId));
        } catch (error) {
            console.error('Error obteniendo habitación:', error);
            showToast('Error al cargar habitación', 'danger');
            return;
        }
    }

    if (!room) {
        showToast('Habitación no disponible', 'danger');
        return;
    }

    const userData = api.getUserData();
    const isAssignedToMe = room.assignedTo && room.assignedTo.id === userData.userId;
    
    // VALIDACIÓN: Si ya está limpia, no abrir modal
    if (room.status === ROOM_STATUS.CLEAN) {
        showToast(`✅ Habitación ${room.number} ya está limpia`, 'info');
        return;
    }

    // VALIDACIÓN: Si no está asignada, no permitir
    if (!isAssignedToMe) {
        showToast(`⛔ Habitación ${room.number} no está asignada a ti`, 'warning');
        return;
    }

    // Actualizar UI del modal
    document.getElementById('modalRoomNumber').textContent = room.number;
    
    const modal = new bootstrap.Modal(document.getElementById('roomModal'));
    modal.show();
};

// Setup event listeners para botones de estado
function setupStatusButtons() {
    // Botón para marcar como limpia
    document.querySelectorAll('.status-btn[data-status]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const newStatus = btn.dataset.status;
            await updateRoomStatus(currentRoomId, newStatus);
        });
    });

    // Botón para reportar incidencia
    const reportBtn = document.getElementById('reportIncidentBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', async () => {
            // Validar que la habitación existe y está asignada
            let room = currentRooms.find(r => r.id === currentRoomId);
            
            // Si no está en el listado, obtener del backend
            if (!room && navigator.onLine) {
                try {
                    room = await api.get(ENDPOINTS.ROOM_BY_ID(currentRoomId));
                } catch (error) {
                    console.error('Error obteniendo habitación:', error);
                    showToast('Error al cargar habitación', 'danger');
                    return;
                }
            }

            if (!room) {
                showToast('Habitación no disponible', 'danger');
                return;
            }

            const userData = api.getUserData();
            const isAssignedToMe = room.assignedTo && room.assignedTo.id === userData.userId;

            // Validar que esté asignada
            if (!isAssignedToMe) {
                showToast('⛔ No puedes reportar incidencias en habitaciones no asignadas', 'warning');
                return;
            }

            // Validar que no esté ya limpia
            if (room.status === ROOM_STATUS.CLEAN) {
                showToast('✅ Esta habitación ya está limpia. No puedes reportar incidencias.', 'info');
                return;
            }
            
            // Cerrar el modal actual
            const modalEl = document.getElementById('roomModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            
            // Guardar temporalmente en sessionStorage para usar en la página de incidencias
            sessionStorage.setItem('pendingIncidentRoom', JSON.stringify({
                id: room.id,
                number: room.number
            }));
            window.location.href = 'incidents.html';
        });
    }
}

// Verificar si una habitación tiene incidencias activas
async function checkActiveIncidents(roomId) {
    try {
        if (navigator.onLine) {
            const incidents = await api.get(ENDPOINTS.INCIDENTS_BY_ROOM(roomId));
            // Filtrar solo incidencias abiertas
            const activeIncidents = incidents.filter(i => i.status === 'OPEN');
            return activeIncidents.length > 0;
        } else {
            // En modo offline, verificar en la base de datos local
            const localIncidents = await dbService.getIncidentsLocal();
            const roomIncidents = localIncidents.filter(i => 
                i.room && i.room.id === roomId && i.status === 'OPEN'
            );
            return roomIncidents.length > 0;
        }
    } catch (error) {
        console.error('Error verificando incidencias:', error);
        // En caso de error, por seguridad asumir que sí hay incidencias
        return true;
    }
}

// Actualizar estado de habitación
// Backend: RoomController.updateRoomStatus() - PATCH /api/rooms/{id}/status
// Offline: Guarda en PouchDB y cola de sincronización
async function updateRoomStatus(roomId, status) {
    try {
        // Validar que la habitación existe
        let room = currentRooms.find(r => r.id === roomId);
        
        if (!room && navigator.onLine) {
            try {
                room = await api.get(ENDPOINTS.ROOM_BY_ID(roomId));
            } catch (error) {
                console.error('Error obteniendo habitación:', error);
                showToast('Error al cargar habitación', 'danger');
                return;
            }
        }

        if (!room) {
            showToast('Habitación no disponible', 'danger');
            return;
        }

        const userData = api.getUserData();
        const isAssignedToMe = room.assignedTo && room.assignedTo.id === userData.userId;

        // VALIDACIÓN: Solo permitir cambiar estado si está asignada
        if (!isAssignedToMe) {
            showToast('⛔ No puedes modificar habitaciones no asignadas', 'warning');
            return;
        }

        // VALIDACIÓN: No permitir cambiar estado si ya está limpia
        if (room.status === ROOM_STATUS.CLEAN) {
            showToast('✅ Esta habitación ya está limpia', 'info');
            return;
        }

        // NUEVA VALIDACIÓN: Verificar si hay incidencias activas antes de marcar como limpia
        if (status === ROOM_STATUS.CLEAN) {
            const hasActiveIncidents = await checkActiveIncidents(roomId);
            if (hasActiveIncidents) {
                showToast('⛔ No se puede marcar como limpia. Esta habitación tiene incidencias activas que deben resolverse primero.', 'danger');
                return;
            }
        }

        // Cerrar modal
        const modalEl = document.getElementById('roomModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // Verificar conectividad antes de intentar enviar
        try {
            if (navigator.onLine) {
                // Intentar actualizar en backend
                await api.patch(ENDPOINTS.ROOM_STATUS(roomId), status);
                showToast('Estado actualizado correctamente', 'success');
            } else {
                // Sin conexión, guardar localmente
                await dbService.updateRoomStatusLocal(roomId, status);
                showToast('💾 Estado guardado localmente. Se sincronizará al conectar.', 'warning');
            }
        } catch (apiError) {
            // Si falla la petición (ej: servidor caído), guardar localmente
            console.log('Error en API, guardando localmente:', apiError);
            try {
                await dbService.updateRoomStatusLocal(roomId, status);
                showToast('💾 Estado guardado localmente. Se sincronizará al conectar.', 'warning');
            } catch (dbError) {
                console.error('Error guardando localmente:', dbError);
                showToast('Error al guardar estado', 'danger');
                return; // Salir sin recargar
            }
        }

        // Recargar habitaciones
        await loadMyRooms();

    } catch (error) {
        console.error('Error updating room status:', error);
        showToast('Error al actualizar estado', 'danger');
    }
}

// Helpers
function getStatusText(status) {
    const statusMap = {
        [ROOM_STATUS.CLEAN]: 'Limpia',
        [ROOM_STATUS.DIRTY]: 'Sucia',
        [ROOM_STATUS.OCCUPIED]: 'Ocupada',
        [ROOM_STATUS.BLOCKED]: 'Bloqueada'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)} hrs`;
    return date.toLocaleDateString();
}

function showToast(message, type = 'info') {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// Indicador de conectividad en el header
function updateConnectivityIndicator() {
    // Remover indicador anterior si existe
    const existing = document.querySelector('.connectivity-indicator');
    if (existing) existing.remove();

    // Crear nuevo indicador
    const indicator = document.createElement('div');
    indicator.className = 'connectivity-indicator';
    
    // Usar la variable isOfflineMode que es más confiable
    const isOnline = !isOfflineMode;
    
    if (isOnline) {
        indicator.innerHTML = '<span class="badge bg-success">🌐 En línea</span>';
    } else {
        indicator.innerHTML = '<span class="badge bg-warning text-dark">📵 Offline</span>';
    }

    document.body.appendChild(indicator);
    
    // Auto-ocultar después de 3 segundos si está online
    if (isOnline) {
        setTimeout(() => {
            if (indicator && indicator.parentElement) {
                indicator.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => indicator.remove(), 300);
            }
        }, 3000);
    }
}

// ============ WEBSOCKET REAL-TIME UPDATES ============
function setupWebSocket() {
    try {
        wsClient.connect(() => {
            console.log('🔌 WebSocket conectado - Suscribiendo a notificaciones...');
            
            // Suscribirse a actualizaciones de habitaciones
            const roomsSub = wsClient.subscribe('/topic/rooms', (notification) => {
                console.log('📨 Notificación de habitación:', notification);
                handleRoomNotification(notification);
            });
            
            // Suscribirse a nuevas incidencias
            const incidentsSub = wsClient.subscribe('/topic/incidents', (notification) => {
                console.log('📨 Notificación de incidencia:', notification);
                handleIncidentNotification(notification);
            });
            
            // Suscribirse a notificaciones generales
            const notificationsSub = wsClient.subscribe('/topic/notifications', (notification) => {
                console.log('📨 Notificación general:', notification);
                showNotificationToast(notification);
            });
            
            wsSubscriptions.push(roomsSub, incidentsSub, notificationsSub);
        });
    } catch (error) {
        console.warn('⚠️ WebSocket no disponible:', error);
        // Continuar sin WebSocket, la app funcionará con polling
    }
}

function handleRoomNotification(notification) {
    const { type, data } = notification;
    
    // Si es una actualización de habitación que nos afecta, recargar
    const userData = api.getUserData();
    if (data.assignedTo && data.assignedTo.id === userData.userId) {
        loadMyRooms();
        showToast(`Habitación ${data.number} actualizada`, 'info');
    }
}

function handleIncidentNotification(notification) {
    const { type, message } = notification;
    
    if (type === 'INCIDENT_CREATED') {
        // Reproducir sonido o mostrar notificación
        showToast('⚠️ ' + message, 'warning');
        
        // Mostrar notificación del navegador si está permitido
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Nueva Incidencia', {
                body: message,
                icon: '/icon-192.png',
                badge: '/icon-72.png'
            });
        }
    }
}

function showNotificationToast(notification) {
    const { message, type } = notification;
    const alertType = type.includes('ERROR') ? 'danger' : 
                      type.includes('WARNING') ? 'warning' : 
                      type.includes('SUCCESS') ? 'success' : 'info';
    
    showToast(message, alertType);
}

// Verificar si hay una habitación pendiente de abrir (desde QR scan)
async function checkPendingRoomOpen() {
    const pendingRoomStr = sessionStorage.getItem('pendingRoomOpen');
    
    if (!pendingRoomStr) {
        return; // No hay habitación pendiente
    }

    try {
        const pendingData = JSON.parse(pendingRoomStr);
        sessionStorage.removeItem('pendingRoomOpen');
        
        const userData = api.getUserData();
        
        if (!pendingData.roomId) {
            console.error('No hay ID de habitación en pendingRoomOpen');
            showToast('Error: Datos de habitación no disponibles', 'danger');
            return;
        }

        // Esperar un momento para que Bootstrap y el DOM estén completamente listos
        await new Promise(resolve => setTimeout(resolve, 500));

        // IMPORTANTE: Obtener datos ACTUALES de la habitación desde el backend
        let currentRoom;
        try {
            currentRoom = await api.get(ENDPOINTS.ROOM_BY_ID(pendingData.roomId));
        } catch (error) {
            console.error('Error obteniendo habitación actual:', error);
            showToast('Error al cargar datos de la habitación', 'danger');
            return;
        }

        if (!currentRoom) {
            showToast('Habitación no encontrada', 'danger');
            return;
        }

        // VALIDACIÓN 1: Verificar si la habitación ya está limpia
        if (currentRoom.status === ROOM_STATUS.CLEAN) {
            showToast(`✅ Habitación ${currentRoom.number} ya está limpia`, 'info');
            return; // No abrir modal
        }

        // VALIDACIÓN 2: Verificar si la habitación está asignada a esta mucama
        const isAssignedToMe = currentRoom.assignedTo && currentRoom.assignedTo.id === userData.userId;

        if (!isAssignedToMe) {
            showToast(`⛔ Habitación ${currentRoom.number} no está asignada a ti`, 'warning');
            return; // No permitir acciones en habitaciones no asignadas
        }

        // Verificar que la función openRoomModal esté disponible
        if (typeof window.openRoomModal !== 'function') {
            console.error('window.openRoomModal no está definida');
            showToast('Error: Modal no disponible', 'danger');
            return;
        }

        // TODO OK: Abrir modal con la habitación
        window.openRoomModal(currentRoom.id, currentRoom.number);
        showToast(`📱 Habitación ${currentRoom.number} (${getStatusText(currentRoom.status)})`, 'success');
        
    } catch (error) {
        console.error('Error al abrir habitación desde QR:', error);
        showToast('Error al abrir habitación desde QR', 'danger');
    }
}

// Limpiar WebSocket al salir
window.addEventListener('beforeunload', () => {
    wsSubscriptions.forEach(sub => wsClient.unsubscribe(sub));
    wsClient.disconnect();
});
