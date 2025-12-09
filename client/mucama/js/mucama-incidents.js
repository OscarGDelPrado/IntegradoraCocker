/* ======================================
   MUCAMA-INCIDENTS.JS - Gestión Incidencias con Offline
   Backend: GET /api/incidents/maid/{maidId}
            POST /api/incidents
            GET /api/rooms/maid/{maidId}
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, INCIDENT_STATUS, USER_ROLES } from '../../js/config.js';
import dbService from './db-service.js';

let allIncidents = [];
let currentFilter = 'all';
let selectedPhotos = [];
let myRooms = [];

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
    window.addEventListener('online', async () => {
        console.log('🌐 Evento ONLINE detectado en mucama-incidents');
        updateConnectivityIndicator();
        showToast('🌐 Conexión restaurada. Sincronizando...', 'info');
        
        try {
            // Sincronizar cambios pendientes
            console.log('📤 Iniciando sincronización desde mucama-incidents...');
            await dbService.processSyncQueue();
            console.log('✅ Sincronización completada');
            
            // Recargar incidencias después de sincronizar
            await loadIncidents();
            showToast('✅ Sincronización completada', 'success');
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            showToast('❌ Error al sincronizar', 'danger');
        }
    });
    window.addEventListener('offline', () => {
        console.log('📴 Evento OFFLINE detectado en mucama-incidents');
        updateConnectivityIndicator();
    });

    // Listener para mensajes del Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', async (event) => {
            console.log('📨 Mensaje del Service Worker:', event.data);
            
            if (event.data.type === 'PROCESS_SYNC_QUEUE') {
                console.log('🔄 Service Worker solicita procesar cola de sincronización');
                try {
                    await dbService.processSyncQueue();
                    await loadIncidents();
                    console.log('✅ Cola procesada desde Service Worker');
                } catch (error) {
                    console.error('❌ Error procesando cola desde SW:', error);
                }
            }
        });
    }

    // Cargar habitaciones asignadas (para el selector)
    await loadMyRooms();

    // Verificar si viene de reportar incidencia desde el dashboard
    checkPendingIncidentRoom();

    // Cargar incidencias
    await loadIncidents();

    // Setup listeners
    setupFilterButtons();
    // setupNewIncidentButton(); // Botón eliminado de la UI
    setupIncidentForm();
    setupPhotoUpload();
    setupCameraButtons();
    setupSyncButton();

    // Auto-refresh cada 30 segundos (solo online)
    setInterval(() => {
        if (navigator.onLine) loadIncidents();
    }, 30000);
});

// Setup botón de sincronización manual
function setupSyncButton() {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            if (!navigator.onLine) {
                showToast('📴 Sin conexión a internet', 'warning');
                return;
            }
            
            syncBtn.disabled = true;
            syncBtn.textContent = '⏳';
            
            try {
                showToast('🔄 Sincronizando...', 'info');
                await dbService.processSyncQueue();
                await loadIncidents();
                showToast('✅ Sincronización completada', 'success');
            } catch (error) {
                console.error('Error en sincronización:', error);
                showToast('❌ Error al sincronizar', 'danger');
            } finally {
                syncBtn.disabled = false;
                syncBtn.textContent = '🔄';
            }
        });
    }
}

// Cargar habitaciones asignadas para el selector (con offline)
async function loadMyRooms() {
    try {
        const userData = api.getUserData();
        
        if (navigator.onLine) {
            myRooms = await api.get(ENDPOINTS.ROOMS_BY_MAID(userData.userId));
            // Guardar en local
            await dbService.saveRoomsLocal(myRooms);
        } else {
            // Usar cache local
            myRooms = await dbService.getRoomsLocal();
            showToast('📴 Modo offline - usando datos guardados', 'warning');
        }
        
        populateRoomSelector();
    } catch (error) {
        console.error('Error loading rooms:', error);
        // Intentar cargar desde cache local
        try {
            myRooms = await dbService.getRoomsLocal();
            populateRoomSelector();
        } catch (e) {
            showToast('Error al cargar habitaciones', 'danger');
        }
    }
}

function populateRoomSelector() {
    const select = document.getElementById('incidentRoom');
    select.innerHTML = '<option value="">Seleccione una habitación</option>' +
        myRooms.map(room => `
            <option value="${room.id}">Hab. ${room.number} - ${room.building?.name || ''}</option>
        `).join('');
}

// Verificar si hay una habitación pendiente para reportar incidencia
function checkPendingIncidentRoom() {
    const pendingRoom = sessionStorage.getItem('pendingIncidentRoom');
    if (pendingRoom) {
        try {
            const room = JSON.parse(pendingRoom);
            // Pre-llenar el campo de habitación
            document.getElementById('incidentRoom').value = room.id;
            document.getElementById('incidentRoomDisplay').value = `Habitación ${room.number}`;
            
            // Limpiar sessionStorage
            sessionStorage.removeItem('pendingIncidentRoom');
            
            // Abrir modal automáticamente
            setTimeout(() => {
                const modal = new bootstrap.Modal(document.getElementById('newIncidentModal'));
                modal.show();
                
                // Enfocar en el campo de descripción
                document.getElementById('incidentDescription').focus();
            }, 300);
        } catch (error) {
            console.error('Error loading pending room:', error);
        }
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

// Cargar incidencias de esta mucama (con offline)
// Backend: IncidentController.getIncidentsByMaid() - GET /api/incidents/maid/{maidId}
async function loadIncidents() {
    try {
        const userData = api.getUserData();
        
        if (navigator.onLine) {
            const incidents = await api.get(ENDPOINTS.INCIDENTS_BY_MAID(userData.userId));
            allIncidents = filterIncidentsByTime(incidents); // Aplicar filtro de tiempo
            
            // Guardar en local
            await dbService.saveIncidentsLocal(allIncidents);
        } else {
            // Usar cache local
            const cachedIncidents = await dbService.getIncidentsLocal();
            allIncidents = filterIncidentsByTime(cachedIncidents); // Aplicar filtro de tiempo
        }
        
        renderIncidents(filterIncidents(allIncidents));

    } catch (error) {
        console.error('Error loading incidents:', error);
        // Intentar cargar desde cache
        try {
            const cachedIncidents = await dbService.getIncidentsLocal();
            allIncidents = filterIncidentsByTime(cachedIncidents); // Aplicar filtro de tiempo
            renderIncidents(filterIncidents(allIncidents));
            showToast('📴 Usando datos guardados', 'info');
        } catch (e) {
            showToast('Error al cargar incidencias', 'danger');
        }
    }
}

function filterIncidents(incidents) {
    if (currentFilter === 'all') return incidents;
    return incidents.filter(inc => inc.status === currentFilter);
}

function renderIncidents(incidents) {
    const container = document.getElementById('incidentsList');
    const emptyState = document.getElementById('emptyState');

    if (incidents.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('d-none');
        return;
    }

    emptyState.classList.add('d-none');
    container.innerHTML = incidents.map(incident => {
        const photoCount = incident.photos ? parsePhotos(incident.photos).length : 0;
        
        return `
        <div class="incident-card" 
             onclick="viewIncidentDetail(${incident.id})">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <strong>Hab. ${incident.room?.number || 'N/A'}</strong>
                    <span class="badge ms-2 ${incident.status === 'OPEN' ? 'badge-open' : 'badge-resolved'}">
                        ${incident.status === 'OPEN' ? 'Abierta' : 'Resuelta'}
                    </span>
                </div>
            </div>
            
            <p class="mb-2">${truncateText(incident.description, 100)}</p>
            
            ${photoCount > 0 ? `
                <div class="mb-2">
                    <small class="text-muted">
                        📷 ${photoCount} foto${photoCount > 1 ? 's' : ''} adjunta${photoCount > 1 ? 's' : ''}
                    </small>
                </div>
            ` : ''}
            
            <small class="text-muted d-block">
                ${formatDate(incident.createdAt)}
            </small>
            <small class="text-primary">
                👆 Toca para ver detalles
            </small>
        </div>
        `;
    }).join('');
}

// Setup filtros
function setupFilterButtons() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.dataset.filter;
            renderIncidents(filterIncidents(allIncidents));
        });
    });
}

// Setup botón nueva incidencia - DESHABILITADO (botón eliminado de UI)
// function setupNewIncidentButton() {
//     document.getElementById('newIncidentBtn').addEventListener('click', () => {
//         const modal = new bootstrap.Modal(document.getElementById('newIncidentModal'));
//         modal.show();
//     });
// }

// Setup formulario de nueva incidencia
function setupIncidentForm() {
    document.getElementById('incidentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createIncident();
    });
}

// Crear nueva incidencia (con offline sync)
// Backend: IncidentController.createIncident() - POST /api/incidents
async function createIncident() {
    try {
        const userData = api.getUserData();
        const roomId = document.getElementById('incidentRoom').value;
        const description = document.getElementById('incidentDescription').value;

        if (!roomId) {
            showToast('Seleccione una habitación', 'warning');
            return;
        }

        if (!description.trim()) {
            showToast('Ingrese una descripción del problema', 'warning');
            return;
        }

        if (selectedPhotos.length === 0) {
            showToast('Debe tomar al menos una foto del problema', 'warning');
            return;
        }

        // Preparar fotos en base64 (comprimidas)
        const photosBase64 = await Promise.all(
            selectedPhotos.map(photo => compressAndConvertToBase64(photo))
        );

        const incidentData = {
            room: { id: parseInt(roomId) },
            reportedBy: { id: userData.userId },
            description: description,
            status: INCIDENT_STATUS.OPEN,
            photos: JSON.stringify(photosBase64)
        };

        // 1. Primero revisar si hay cambios pendientes en la cola
        console.log('🔍 Revisando cola de sincronización antes de crear incidencia...');
        await dbService.processSyncQueue();

        // 2. Intentar enviar la nueva incidencia
        try {
            // Verificar conectividad
            if (!navigator.onLine) {
                throw new Error('Sin conexión a internet');
            }

            // Intentar enviar directamente al backend
            console.log('🌐 Conexión disponible, enviando incidencia al servidor...');
            await api.post(ENDPOINTS.INCIDENTS, incidentData);
            console.log('✅ Incidencia enviada correctamente al servidor');
            showToast('Incidencia registrada correctamente', 'success');
            
        } catch (apiError) {
            // 3. Si falla (sin conexión o error del servidor), guardar localmente
            console.log('⚠️ Error al enviar al servidor, guardando localmente:', apiError.message);
            
            try {
                await dbService.createIncidentLocal(incidentData);
                console.log('💾 Incidencia guardada en cola de sincronización');
                showToast('📴 Sin conexión. Incidencia guardada, se enviará automáticamente al reconectar', 'warning');
                
                // Intentar registrar background sync si está disponible
                if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
                    try {
                        const registration = await navigator.serviceWorker.ready;
                        await registration.sync.register('sync-pending-incidents');
                        console.log('🔄 Background sync registrado');
                    } catch (syncError) {
                        console.log('⚠️ No se pudo registrar background sync:', syncError);
                    }
                }
                
            } catch (dbError) {
                console.error('❌ Error guardando localmente:', dbError);
                showToast('Error al guardar incidencia. Por favor intente nuevamente', 'danger');
                return; // Salir sin cerrar el modal para que el usuario pueda reintentar
            }
        }

        // 4. Cerrar modal y resetear
        const modal = bootstrap.Modal.getInstance(document.getElementById('newIncidentModal'));
        if (modal) modal.hide();
        resetIncidentForm();

        // 5. Recargar lista
        await loadIncidents();

    } catch (error) {
        console.error('❌ Error creating incident:', error);
        showToast('Error al registrar incidencia', 'danger');
    }
}

// Variables para la cámara
let cameraStream = null;
let currentFacingMode = 'environment';

// Setup botones de cámara
function setupCameraButtons() {
    // Botón cámara trasera
    const btnBack = document.getElementById('takePrimaryPhoto');
    btnBack.addEventListener('click', () => {
        if (selectedPhotos.length >= 3) {
            showToast('Máximo 3 fotos permitidas', 'warning');
            return;
        }
        openCamera('environment');
    });
    
    // Botón cámara frontal
    const btnFront = document.getElementById('takeSelfiePhoto');
    btnFront.addEventListener('click', () => {
        if (selectedPhotos.length >= 3) {
            showToast('Máximo 3 fotos permitidas', 'warning');
            return;
        }
        openCamera('user');
    });
    
    // Botón capturar foto
    const captureBtn = document.getElementById('capturePhotoBtn');
    captureBtn.addEventListener('click', capturePhoto);
    
    // Botón cerrar cámara
    const closeBtn = document.getElementById('closeCameraBtn');
    closeBtn.addEventListener('click', closeCamera);
}

// Abrir cámara con MediaDevices API
async function openCamera(facingMode) {
    try {
        currentFacingMode = facingMode;
        
        const constraints = {
            video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
            }
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const video = document.getElementById('cameraVideo');
        video.srcObject = cameraStream;
        
        // Mostrar visor de cámara
        document.getElementById('cameraView').classList.remove('d-none');
        
        console.log('Cámara abierta:', facingMode === 'environment' ? 'Trasera' : 'Frontal');
    } catch (error) {
        console.error('Error al abrir cámara:', error);
        showToast('No se pudo acceder a la cámara. Verifica los permisos.', 'danger');
    }
}

// Capturar foto desde el video
function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('photoCanvas');
    const ctx = canvas.getContext('2d');
    
    // Configurar canvas al tamaño del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dibujar frame actual del video en el canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir canvas a blob
    canvas.toBlob((blob) => {
        if (blob) {
            // Crear un File object desde el blob
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            selectedPhotos.push(file);
            renderPhotoPreview();
            
            // Cerrar cámara
            closeCamera();
            
            showToast('✅ Foto capturada correctamente', 'success');
        }
    }, 'image/jpeg', 0.9);
}

// Cerrar cámara
function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    const video = document.getElementById('cameraVideo');
    video.srcObject = null;
    
    document.getElementById('cameraView').classList.add('d-none');
}

// Setup carga de fotos (legacy - ya no se usa pero lo dejamos por compatibilidad)
function setupPhotoUpload() {
    // Esta función se mantiene vacía o puede eliminarse
    // La funcionalidad ahora está en setupCameraButtons
}

function renderPhotoPreview() {
    const container = document.getElementById('photoPreviewContainer');
    container.innerHTML = selectedPhotos.map((photo, index) => `
        <div class="photo-preview">
            <img src="${URL.createObjectURL(photo)}" alt="Preview">
            <div class="photo-preview-remove" onclick="removePhoto(${index})">×</div>
        </div>
    `).join('');
}

window.removePhoto = (index) => {
    selectedPhotos.splice(index, 1);
    renderPhotoPreview();
};

// Comprimir imagen a base64 (máx 0.5MB por foto según README)
async function compressAndConvertToBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Resize si es muy grande
                const maxDimension = 1024;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Comprimir a JPEG 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function resetIncidentForm() {
    document.getElementById('incidentForm').reset();
    document.getElementById('incidentRoom').value = '';
    document.getElementById('incidentRoomDisplay').value = '';
    document.getElementById('incidentDescription').value = '';
    selectedPhotos = [];
    renderPhotoPreview();
    
    // Cerrar cámara si está abierta
    closeCamera();
}

// Ver detalle de incidencia
window.viewIncidentDetail = async (incidentId) => {
    try {
        const incident = await api.get(ENDPOINTS.INCIDENT_BY_ID(incidentId));
        
        const content = `
            <div class="p-3">
                <div class="mb-3">
                    <h6>Habitación</h6>
                    <p>${incident.room?.number || 'N/A'} - ${incident.room?.building?.name || ''}</p>
                </div>
                
                <div class="mb-3">
                    <h6>Estado</h6>
                    <span class="badge ${incident.status === 'OPEN' ? 'badge-open' : 'badge-resolved'}">
                        ${incident.status === 'OPEN' ? 'Abierta' : 'Resuelta'}
                    </span>
                </div>
                
                <div class="mb-3">
                    <h6>Descripción</h6>
                    <p>${incident.description}</p>
                </div>
                
                ${incident.photos ? `
                    <div class="mb-3">
                        <h6>Fotos</h6>
                        <div class="d-flex gap-2 flex-wrap">
                            ${parsePhotos(incident.photos).map(photo => `
                                <img src="${photo}" class="img-fluid" style="max-width: 150px; border-radius: 8px;">
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${incident.status === 'RESOLVED' && incident.resolutionNotes ? `
                    <div class="mb-3">
                        <h6>Notas de Resolución</h6>
                        <p>${incident.resolutionNotes}</p>
                    </div>
                ` : ''}
                
                <div class="mb-3">
                    <small class="text-muted">Creada: ${formatDate(incident.createdAt)}</small><br>
                    ${incident.resolvedAt ? `<small class="text-muted">Resuelta: ${formatDate(incident.resolvedAt)}</small>` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('incidentDetailContent').innerHTML = content;
        const modal = new bootstrap.Modal(document.getElementById('incidentDetailModal'));
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
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
