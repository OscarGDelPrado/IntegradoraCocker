/* ======================================
   RECEPCION-DASHBOARD.JS - Dashboard Principal
   Backend: GET /api/rooms, /api/incidents
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, ROOM_STATUS, INCIDENT_STATUS, USER_ROLES } from '../../js/config.js';

let roomsChart = null;
let incidentsChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticación y rol
    if (!api.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }

    const userData = api.getUserData();
    if (userData.role !== USER_ROLES.RECEPTION && userData.role !== USER_ROLES.ADMIN) {
        window.location.href = '/index.html';
        return;
    }

    // Mostrar nombre de usuario
    document.getElementById('userNameSidebar').textContent = userData.name;

    // Setup listeners
    document.getElementById('logoutBtn').addEventListener('click', () => {
        api.logout();
        window.location.href = '/index.html';
    });

    document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

    // Cargar dashboard
    await loadDashboard();

    // Auto-refresh cada 60 segundos
    setInterval(loadDashboard, 60000);
});

// Filtrar incidencias creadas antes de las 8 AM del día actual
function filterIncidentsByTime(incidents) {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // 8:00 AM de hoy
    
    // Si aún no son las 8 AM, mostrar todas
    if (now < today8AM) {
        return incidents;
    }
    
    // Si ya pasaron las 8 AM, filtrar solo las creadas después de las 8 AM de hoy
    return incidents.filter(incident => {
        const createdAt = new Date(incident.createdAt);
        return createdAt >= today8AM;
    });
}

// Cargar todos los datos del dashboard
async function loadDashboard() {
    try {
        // Llamadas en paralelo para eficiencia
        // Backend: RoomController.getAllRooms(), IncidentController.getAllIncidents()
        const [rooms, allIncidents] = await Promise.all([
            api.get(ENDPOINTS.ROOMS),
            api.get(ENDPOINTS.INCIDENTS)
        ]);

        // Aplicar filtro de tiempo a las incidencias
        const incidents = filterIncidentsByTime(allIncidents);

        updateKPIs(rooms, incidents);
        updateCharts(rooms, incidents);
        updateRecentIncidents(incidents);
        updateMaidStats(rooms);
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error al cargar dashboard', 'danger');
    }
}

// Actualizar KPIs principales
function updateKPIs(rooms, incidents) {
    const cleanRooms = rooms.filter(r => r.status === ROOM_STATUS.CLEAN).length;
    const dirtyRooms = rooms.filter(r => r.status === ROOM_STATUS.DIRTY).length;
    
    // Calcular habitaciones bloqueadas (con incidencias activas)
    const roomsWithActiveIncidents = new Set();
    incidents.filter(i => i.status === INCIDENT_STATUS.OPEN).forEach(incident => {
        if (incident.room && incident.room.id) {
            roomsWithActiveIncidents.add(incident.room.id);
        }
    });
    const blockedRooms = roomsWithActiveIncidents.size;
    
    const openIncidents = incidents.filter(i => i.status === INCIDENT_STATUS.OPEN).length;

    document.getElementById('kpiClean').textContent = cleanRooms;
    document.getElementById('kpiDirty').textContent = dirtyRooms;
    document.getElementById('kpiOccupied').textContent = blockedRooms; // Mostrar bloqueadas en lugar de ocupadas
    document.getElementById('kpiIncidents').textContent = openIncidents;
}

// Actualizar gráficas con Chart.js
function updateCharts(rooms, incidents) {
    // Calcular habitaciones bloqueadas (con incidencias activas)
    const roomsWithActiveIncidents = new Set();
    incidents.filter(i => i.status === INCIDENT_STATUS.OPEN).forEach(incident => {
        if (incident.room && incident.room.id) {
            roomsWithActiveIncidents.add(incident.room.id);
        }
    });
    const blockedRooms = roomsWithActiveIncidents.size;
    
    // Gráfica de habitaciones por estado
    const roomsData = {
        labels: ['Limpias', 'Sucias', 'Bloqueadas'],
        datasets: [{
            data: [
                rooms.filter(r => r.status === ROOM_STATUS.CLEAN).length,
                rooms.filter(r => r.status === ROOM_STATUS.DIRTY).length,
                blockedRooms
            ],
            backgroundColor: ['#198754', '#ffc107', '#dc3545']
        }]
    };

    if (roomsChart) {
        roomsChart.destroy();
    }

    const roomsCtx = document.getElementById('roomsChart').getContext('2d');
    roomsChart = new Chart(roomsCtx, {
        type: 'doughnut',
        data: roomsData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Gráfica de incidencias por severidad
    const incidentsData = {
        labels: ['Alta', 'Media', 'Baja'],
        datasets: [{
            label: 'Incidencias',
            data: [
                incidents.filter(i => i.severity === 'HIGH').length,
                incidents.filter(i => i.severity === 'MEDIUM').length,
                incidents.filter(i => i.severity === 'LOW').length
            ],
            backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0']
        }]
    };

    if (incidentsChart) {
        incidentsChart.destroy();
    }

    const incidentsCtx = document.getElementById('incidentsChart').getContext('2d');
    incidentsChart = new Chart(incidentsCtx, {
        type: 'bar',
        data: incidentsData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Actualizar tabla de incidencias recientes
function updateRecentIncidents(incidents) {
    const tbody = document.getElementById('recentIncidents');
    
    // Mostrar últimas 5 incidencias abiertas
    const recentOpen = incidents
        .filter(i => i.status === INCIDENT_STATUS.OPEN)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    if (recentOpen.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay incidencias abiertas</td></tr>';
        return;
    }

    tbody.innerHTML = recentOpen.map(incident => `
        <tr onclick="window.location.href='incidents.html?id=${incident.id}'" style="cursor: pointer;">
            <td><strong>${incident.room?.number || 'N/A'}</strong></td>
            <td>${truncateText(incident.description, 50)}</td>
            <td><span class="badge severity-${incident.severity}">${getSeverityText(incident.severity)}</span></td>
            <td><span class="badge badge-open">Abierta</span></td>
        </tr>
    `).join('');
}

// Actualizar estadísticas por mucama
function updateMaidStats(rooms) {
    const container = document.getElementById('maidStats');
    
    // Agrupar habitaciones por mucama
    const roomsByMaid = {};
    rooms.forEach(room => {
        if (room.assignedTo) {
            const maidId = room.assignedTo.id;
            if (!roomsByMaid[maidId]) {
                roomsByMaid[maidId] = {
                    maid: room.assignedTo,
                    total: 0,
                    clean: 0
                };
            }
            roomsByMaid[maidId].total++;
            if (room.status === ROOM_STATUS.CLEAN) {
                roomsByMaid[maidId].clean++;
            }
        }
    });

    const maidArray = Object.values(roomsByMaid);

    if (maidArray.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No hay asignaciones</p>';
        return;
    }

    container.innerHTML = maidArray.map(({ maid, total, clean }) => {
        const percentage = total > 0 ? (clean / total) * 100 : 0;
        return `
            <div class="maid-stat-item">
                <div class="maid-stat-name">${maid.name}</div>
                <div class="d-flex justify-content-between">
                    <small class="text-muted">${clean} de ${total} limpias</small>
                    <small class="text-muted">${percentage.toFixed(0)}%</small>
                </div>
                <div class="maid-stat-bar">
                    <div class="maid-stat-progress" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Actualizar timestamp
function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = `Actualizado: ${timeString}`;
}

// Helpers
function getSeverityText(severity) {
    const map = {
        'HIGH': 'Alta',
        'MEDIUM': 'Media',
        'LOW': 'Baja'
    };
    return map[severity] || severity;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}
