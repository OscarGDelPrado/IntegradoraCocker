/* ======================================
   MUCAMA-QR.JS - Escaneo QR para Acceso Rápido a Habitaciones
   Backend: GET /api/rooms/{id} - RoomController.getRoomById()
   ====================================== */

import api from '../../js/api.js';
import { ENDPOINTS, USER_ROLES } from '../../js/config.js';
import dbService from './db-service.js';

let qrScanner = null;

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

    // Connectivity check
    if (!navigator.onLine) {
        showError('📴 Sin conexión. El escaneo QR requiere internet.');
    }

    // Iniciar escáner QR
    await initQRScanner();

    // Setup búsqueda manual
    document.getElementById('searchRoomBtn').addEventListener('click', searchRoom);
    document.getElementById('manualRoomSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchRoom();
        }
    });
});

// Inicializar escáner QR con html5-qrcode
async function initQRScanner() {
    try {
        qrScanner = new Html5Qrcode("qr-reader");
        
        await qrScanner.start(
            { facingMode: "environment" }, // Cámara trasera
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            onScanSuccess,
            onScanError
        );

    } catch (error) {
        console.error('Error starting QR scanner:', error);
        showError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
}

// Callback cuando se escanea exitosamente
async function onScanSuccess(decodedText, decodedResult) {
    // Detener escáner
    qrScanner.stop();

    try {
        // Parsear datos del QR (formato: JSON con id, number, hotel, building, timestamp)
        const roomData = JSON.parse(decodedText);
        
        // Validar estructura
        if (!roomData.id || !roomData.number) {
            throw new Error('QR inválido');
        }

        // Validar caducidad (30 días según README)
        const qrDate = new Date(roomData.timestamp);
        const now = new Date();
        const daysDiff = (now - qrDate) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 30) {
            showError('Este código QR ha caducado (>30 días)');
            restartScanner();
            return;
        }

        // Acceder a la habitación
        await accessRoom(roomData.id);

    } catch (error) {
        console.error('Error parsing QR:', error);
        showError('Código QR inválido o formato incorrecto');
        restartScanner();
    }
}

function onScanError(error) {
    // No hacer nada, errores de escaneo son normales
}

// Acceder a una habitación (por QR o búsqueda manual)
async function accessRoom(roomId) {
    try {
        if (!navigator.onLine) {
            showError('📴 Sin conexión. Necesitas internet para acceder a habitaciones.');
            restartScanner();
            return;
        }

        showSuccess('🔍 Buscando habitación...');

        // Obtener datos completos de la habitación del backend
        const room = await api.get(ENDPOINTS.ROOM_BY_ID(roomId));
        
        if (!room) {
            showError('Habitación no encontrada');
            restartScanner();
            return;
        }

        const userData = api.getUserData();
        const isAssigned = room.assignedTo && room.assignedTo.id === userData.userId;

        // Guardar datos COMPLETOS de la habitación en sessionStorage
        sessionStorage.setItem('pendingRoomOpen', JSON.stringify({
            roomId: room.id,
            roomNumber: room.number,
            roomData: room, // Guardar objeto completo para evitar otra llamada API
            isAssigned: isAssigned,
            scannedFromQR: true
        }));

        // Redirigir al dashboard donde se abrirá el modal automáticamente
        showSuccess(`✅ Accediendo a habitación ${room.number}...`);
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);

    } catch (error) {
        console.error('Error accessing room:', error);
        showError('Error al acceder a la habitación');
        restartScanner();
    }
}

// Búsqueda manual de habitación por número
async function searchRoom() {
    const input = document.getElementById('manualRoomSearch');
    const roomNumber = input.value.trim();

    if (!roomNumber) {
        showError('Por favor ingresa un número de habitación');
        return;
    }

    try {
        const btn = document.getElementById('searchRoomBtn');
        btn.disabled = true;
        btn.textContent = 'Buscando...';

        // Obtener todas las habitaciones y buscar por número
        const rooms = await api.get(ENDPOINTS.ROOMS);
        const room = rooms.find(r => r.number === roomNumber);

        if (!room) {
            showError(`Habitación ${roomNumber} no encontrada`);
            btn.disabled = false;
            btn.textContent = 'Buscar';
            return;
        }

        // Acceder a la habitación encontrada
        await accessRoom(room.id);

    } catch (error) {
        console.error('Error searching room:', error);
        showError('Error al buscar habitación');
        const btn = document.getElementById('searchRoomBtn');
        btn.disabled = false;
        btn.textContent = 'Buscar';
    }
}

// Reiniciar escáner después de error
function restartScanner() {
    setTimeout(() => {
        document.getElementById('qr-error').classList.add('d-none');
        if (qrScanner) {
            qrScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                onScanError
            );
        }
    }, 3000);
}

function showError(message) {
    const errorDiv = document.getElementById('qr-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// Limpiar al salir de la página
window.addEventListener('beforeunload', () => {
    if (qrScanner) {
        qrScanner.stop();
    }
});
