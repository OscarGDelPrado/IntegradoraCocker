/* ======================================
   RECEPCION-QR.JS - Generación de Códigos QR
   Backend: GET /api/rooms
   Nota: La generación de QR es solo frontend
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, USER_ROLES } from '../../js/config.js';

let allRooms = [];
let buildings = [];

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

    await loadRoomsAndBuildings();
    setupFilters();
    setupButtons();
});

// Cargar habitaciones
async function loadRoomsAndBuildings() {
    try {
        // Verificar que QRCode esté disponible
        if (typeof QRCode === 'undefined') {
            console.warn('QRCode library not loaded yet, retrying...');
            setTimeout(loadRoomsAndBuildings, 500);
            return;
        }

        allRooms = await api.get(ENDPOINTS.ROOMS);
        
        // Extraer edificios únicos
        const buildingMap = new Map();
        allRooms.forEach(room => {
            if (room.building) {
                buildingMap.set(room.building.id, room.building);
            }
        });
        buildings = Array.from(buildingMap.values());
        
        populateBuildingFilter();
        renderQRCodes(allRooms);
        
    } catch (error) {
        console.error('Error loading rooms:', error);
        showToast('Error al cargar habitaciones', 'danger');
    }
}

function populateBuildingFilter() {
    const select = document.getElementById('filterBuilding');
    select.innerHTML = '<option value="">Todos los edificios</option>' +
        buildings.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
}

// Renderizar códigos QR
function renderQRCodes(rooms) {
    const container = document.getElementById('qrCodesGrid');
    container.innerHTML = '';

    if (rooms.length === 0) {
        container.innerHTML = '<p class="text-center text-muted w-100">No hay habitaciones</p>';
        return;
    }

    rooms.forEach(room => {
        const qrItem = document.createElement('div');
        qrItem.className = 'qr-item';
        qrItem.id = `qr-${room.id}`;
        qrItem.style.cursor = 'pointer';
        
        const qrData = JSON.stringify({
            id: room.id,
            number: room.number,
            building: room.building?.name || 'N/A',
            hotel: room.building?.hotel?.name || 'Hotel',
            timestamp: new Date().toISOString()
        });

        qrItem.innerHTML = `
            <div class="qr-code-container" id="qr-code-${room.id}"></div>
            <div class="qr-item-label">Habitación ${room.number}</div>
            <small class="text-muted">${room.building?.name || ''}</small>
        `;

        // Click event para abrir modal
        qrItem.addEventListener('click', () => openQRModal(room, qrData));

        container.appendChild(qrItem);

        // Generar QR con QRCode.js (verificar que esté disponible)
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(document.getElementById(`qr-code-${room.id}`), {
                    text: qrData,
                    width: 150,
                    height: 150,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (error) {
                console.error(`Error generating QR for room ${room.number}:`, error);
                document.getElementById(`qr-code-${room.id}`).innerHTML = 
                    '<span class="text-danger">❌ Error</span>';
            }
        } else {
            document.getElementById(`qr-code-${room.id}`).innerHTML = 
                '<span class="text-warning">⏳ Cargando...</span>';
        }
    });
}

// Setup filtros
function setupFilters() {
    const buildingFilter = document.getElementById('filterBuilding');
    const floorFilter = document.getElementById('filterFloor');
    const clearBtn = document.getElementById('clearFilters');

    const applyFilters = () => {
        let filtered = allRooms;

        const buildingId = buildingFilter.value;
        if (buildingId) {
            filtered = filtered.filter(r => r.building?.id == buildingId);
        }

        const floor = floorFilter.value;
        if (floor) {
            filtered = filtered.filter(r => r.floor == floor);
        }

        renderQRCodes(filtered);
    };

    buildingFilter.addEventListener('change', applyFilters);
    floorFilter.addEventListener('input', applyFilters);

    clearBtn.addEventListener('click', () => {
        buildingFilter.value = '';
        floorFilter.value = '';
        renderQRCodes(allRooms);
    });
}

// Setup botones
function setupButtons() {
    document.getElementById('generateAllBtn').addEventListener('click', () => {
        renderQRCodes(allRooms);
        showToast('Códigos QR generados correctamente', 'success');
    });

    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });
}

// Abrir modal con QR ampliado
function openQRModal(room, qrData) {
    // Actualizar información
    document.getElementById('qrModalLabel').textContent = `Código QR - Habitación ${room.number}`;
    document.getElementById('modalRoomNumber').textContent = room.number;
    document.getElementById('modalBuildingName').textContent = room.building?.name || 'N/A';
    document.getElementById('modalFloor').textContent = room.floor || 'N/A';

    // Limpiar contenedor previo
    const container = document.getElementById('qrModalContainer');
    container.innerHTML = '';

    // Generar QR más grande en el modal
    try {
        new QRCode(container, {
            text: qrData,
            width: 300,
            height: 300,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H // Mayor nivel de corrección para QR grande
        });
    } catch (error) {
        console.error('Error generating modal QR:', error);
        container.innerHTML = '<span class="text-danger">Error al generar código QR</span>';
    }

    // Configurar botón de descarga
    const downloadBtn = document.getElementById('downloadQRBtn');
    downloadBtn.onclick = () => downloadQR(room);

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('qrModal'));
    modal.show();
}

// Descargar código QR como imagen
function downloadQR(room) {
    const container = document.getElementById('qrModalContainer');
    const canvas = container.querySelector('canvas');
    
    if (!canvas) {
        showToast('No se pudo generar la imagen', 'danger');
        return;
    }

    try {
        // Convertir canvas a blob y descargar
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `QR_Habitacion_${room.number}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showToast(`QR de habitación ${room.number} descargado`, 'success');
        });
    } catch (error) {
        console.error('Error downloading QR:', error);
        showToast('Error al descargar el código QR', 'danger');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}
