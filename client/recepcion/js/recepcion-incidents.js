/* ======================================
   RECEPCION-INCIDENTS.JS - Gestión Incidencias
   Backend: GET /api/incidents
            PATCH /api/incidents/{id}/resolve
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, INCIDENT_STATUS, USER_ROLES } from '../../js/config.js';

let allIncidents = [];

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

    await loadIncidents();
    setupFilters();
    setupResolveForm();
    setupForceCleanButton();

    // Auto-refresh cada 30 segundos
    setInterval(loadIncidents, 30000);
});

// Setup botón de limpieza forzada
function setupForceCleanButton() {
    document.getElementById('forceCleanIncidentsBtn').addEventListener('click', async () => {
        if (!confirm('¿Está seguro de forzar la limpieza de todas las incidencias antiguas?\n\nEsto marcará como resueltas todas las incidencias creadas antes de las 8:00 AM de hoy.')) {
            return;
        }
        
        await forceCleanOldIncidents();
    });
}

// Forzar limpieza de incidencias antiguas (anteriores a las 8 AM de hoy)
async function forceCleanOldIncidents() {
    try {
        const now = new Date();
        const today8AM = new Date(now);
        today8AM.setHours(8, 0, 0, 0);
        
        // Obtener TODAS las incidencias sin filtro
        const allIncidentsRaw = await api.get(ENDPOINTS.INCIDENTS);
        
        // Filtrar solo las incidencias abiertas creadas antes de las 8 AM de hoy
        const oldIncidents = allIncidentsRaw.filter(incident => {
            if (incident.status !== INCIDENT_STATUS.OPEN) return false;
            
            const createdAt = new Date(incident.createdAt);
            return createdAt < today8AM;
        });
        
        if (oldIncidents.length === 0) {
            showToast('No hay incidencias antiguas para limpiar', 'info');
            return;
        }
        
        // Resolver cada incidencia antigua
        let successCount = 0;
        for (const incident of oldIncidents) {
            try {
                await api.patch(ENDPOINTS.INCIDENT_RESOLVE(incident.id), 
                    'Incidencia resuelta automáticamente por limpieza forzada del sistema');
                successCount++;
            } catch (error) {
                console.error(`Error resolviendo incidencia ${incident.id}:`, error);
            }
        }
        
        showToast(`${successCount} de ${oldIncidents.length} incidencias limpiadas correctamente`, 'success');
        await loadIncidents();
        
    } catch (error) {
        console.error('Error en limpieza forzada:', error);
        showToast('Error al forzar limpieza de incidencias', 'danger');
    }
}

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

// Cargar todas las incidencias
// Backend: IncidentController.getAllIncidents() - GET /api/incidents
async function loadIncidents() {
    try {
        const incidents = await api.get(ENDPOINTS.INCIDENTS);
        allIncidents = filterIncidentsByTime(incidents); // Aplicar filtro de tiempo
        applyFilters();
        updateCounts();
    } catch (error) {
        console.error('Error loading incidents:', error);
        showToast('Error al cargar incidencias', 'danger');
    }
}

function updateCounts() {
    const open = allIncidents.filter(i => i.status === INCIDENT_STATUS.OPEN).length;
    const resolved = allIncidents.filter(i => i.status === INCIDENT_STATUS.RESOLVED).length;
    
    document.getElementById('openCount').textContent = `${open} Abiertas`;
    document.getElementById('resolvedCount').textContent = `${resolved} Resueltas`;
}

function renderIncidents(incidents) {
    const tbody = document.getElementById('incidentsTableBody');
    
    if (incidents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay incidencias</td></tr>';
        return;
    }

    tbody.innerHTML = incidents.map(incident => `
        <tr>
            <td><strong>#${incident.id}</strong></td>
            <td>${incident.room?.number || 'N/A'}</td>
            <td>${truncateText(incident.description, 50)}</td>
            <td>${incident.reportedBy?.name || 'N/A'}</td>
            <td>
                <span class="badge ${incident.status === 'OPEN' ? 'badge-open' : 'badge-resolved'}">
                    ${incident.status === 'OPEN' ? 'Abierta' : 'Resuelta'}
                </span>
            </td>
            <td>${formatDate(incident.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-action" onclick="viewDetail(${incident.id})">
                    Ver
                </button>
                ${incident.status === 'OPEN' ? `
                    <button class="btn btn-sm btn-outline-success btn-action" onclick="openResolveModal(${incident.id})">
                        Resolver
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// Setup filtros
function setupFilters() {
    const statusFilter = document.getElementById('filterStatus');
    const searchInput = document.getElementById('searchIncident');
    const clearBtn = document.getElementById('clearFilters');

    statusFilter.addEventListener('change', applyFilters);
    searchInput.addEventListener('input', applyFilters);

    clearBtn.addEventListener('click', () => {
        statusFilter.value = 'OPEN';
        searchInput.value = '';
        applyFilters();
    });
}

function applyFilters() {
    let filtered = allIncidents;

    const status = document.getElementById('filterStatus').value;
    if (status) {
        filtered = filtered.filter(i => i.status === status);
    }

    const search = document.getElementById('searchIncident').value.toLowerCase();
    if (search) {
        filtered = filtered.filter(i =>
            i.description.toLowerCase().includes(search) ||
            i.room?.number.toLowerCase().includes(search)
        );
    }

    renderIncidents(filtered);
}

// Abrir modal para resolver incidencia
window.openResolveModal = (incidentId) => {
    document.getElementById('resolveIncidentId').value = incidentId;
    document.getElementById('resolutionNotes').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('resolveModal'));
    modal.show();
};

// Setup formulario de resolución
function setupResolveForm() {
    document.getElementById('resolveForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await resolveIncident();
    });
}

// Resolver incidencia
// Backend: IncidentController.resolveIncident() - PATCH /api/incidents/{id}/resolve
async function resolveIncident() {
    try {
        const incidentId = document.getElementById('resolveIncidentId').value;
        const notes = document.getElementById('resolutionNotes').value;

        await api.patch(ENDPOINTS.INCIDENT_RESOLVE(incidentId), notes);

        showToast('Incidencia marcada como resuelta', 'success');

        const modal = bootstrap.Modal.getInstance(document.getElementById('resolveModal'));
        modal.hide();

        await loadIncidents();

    } catch (error) {
        console.error('Error resolving incident:', error);
        showToast('Error al resolver incidencia', 'danger');
    }
}

// Ver detalle de incidencia
window.viewDetail = async (incidentId) => {
    try {
        const incident = await api.get(ENDPOINTS.INCIDENT_BY_ID(incidentId));
        
        const content = `
            <div class="row g-3">
                <div class="col-md-6">
                    <strong>Habitación:</strong><br>
                    ${incident.room?.number || 'N/A'} - ${incident.room?.building?.name || ''}
                </div>
                <div class="col-md-6">
                    <strong>Reportado por:</strong><br>
                    ${incident.reportedBy?.name || 'N/A'}
                </div>
                <div class="col-md-6">
                    <strong>Estado:</strong><br>
                    <span class="badge ${incident.status === 'OPEN' ? 'badge-open' : 'badge-resolved'}">
                        ${incident.status === 'OPEN' ? 'Abierta' : 'Resuelta'}
                    </span>
                </div>
                <div class="col-12">
                    <strong>Descripción:</strong><br>
                    <p class="mb-0">${incident.description}</p>
                </div>
                ${incident.photos ? `
                    <div class="col-12">
                        <strong>Fotos:</strong><br>
                        <div class="d-flex gap-2 flex-wrap mt-2">
                            ${parsePhotos(incident.photos).map(photo => `
                                <img src="${photo}" class="img-thumbnail" style="max-width: 200px; cursor: pointer;" 
                                     onclick="window.open('${photo}', '_blank')">
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${incident.status === 'RESOLVED' && incident.resolutionNotes ? `
                    <div class="col-12">
                        <strong>Notas de Resolución:</strong><br>
                        <p class="mb-0">${incident.resolutionNotes}</p>
                    </div>
                    <div class="col-12">
                        <strong>Resuelta el:</strong><br>
                        ${formatDate(incident.resolvedAt)}
                    </div>
                ` : ''}
                <div class="col-12">
                    <small class="text-muted">Creada: ${formatDate(incident.createdAt)}</small>
                </div>
            </div>
        `;
        
        document.getElementById('incidentDetailContent').innerHTML = content;
        const modal = new bootstrap.Modal(document.getElementById('detailModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading incident detail:', error);
        showToast('Error al cargar detalle', 'danger');
    }
};

// Helpers
function parsePhotos(photosJson) {
    try {
        return JSON.parse(photosJson);
    } catch {
        return [];
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}
