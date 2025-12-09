/* ======================================
   SW-REGISTER.JS - Registro del Service Worker
   Registro y gestión del ciclo de vida del SW
   ====================================== */

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });
            
            console.log('✅ Service Worker registrado:', registration.scope);
            
            // Actualizar SW cuando haya nueva versión
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('🔄 Nueva versión del Service Worker encontrada');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Hay una nueva versión disponible
                        showUpdateNotification(newWorker);
                    }
                });
            });
            
            // Solicitar permiso para notificaciones
            requestNotificationPermission();
            
        } catch (error) {
            console.error('❌ Error al registrar Service Worker:', error);
        }
    });
    
    // Escuchar mensajes del SW
    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📩 Mensaje del Service Worker:', event.data);
        
        if (event.data.type === 'SYNC_COMPLETE') {
            showToast('✅ Sincronización completada', 'success');
        }
    });
}

// Solicitar permiso para notificaciones push
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones');
        return;
    }
    
    if (Notification.permission === 'default') {
        // Esperar 3 segundos antes de pedir permiso
        setTimeout(async () => {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                console.log('✅ Permiso de notificaciones concedido');
                showToast('Notificaciones activadas', 'success');
            } else {
                console.log('❌ Permiso de notificaciones denegado');
            }
        }, 3000);
    }
}

// Mostrar notificación de actualización disponible
function showUpdateNotification(newWorker) {
    const updateBanner = document.createElement('div');
    updateBanner.className = 'alert alert-info alert-dismissible position-fixed bottom-0 start-50 translate-middle-x mb-3';
    updateBanner.style.zIndex = '9999';
    updateBanner.style.maxWidth = '400px';
    updateBanner.innerHTML = `
        <strong>📦 Actualización disponible</strong><br>
        Hay una nueva versión de la aplicación.
        <button class="btn btn-sm btn-primary mt-2 w-100" onclick="updateServiceWorker()">
            Actualizar ahora
        </button>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(updateBanner);
    
    // Guardar referencia al nuevo worker
    window.newServiceWorker = newWorker;
}

// Actualizar Service Worker
window.updateServiceWorker = function() {
    if (window.newServiceWorker) {
        window.newServiceWorker.postMessage({ type: 'SKIP_WAITING' });
        
        // Recargar página cuando el nuevo SW tome control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
};

// Registrar sync para operaciones pendientes
async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-pending-changes');
            console.log('✅ Background sync registrado');
        } catch (error) {
            console.error('❌ Error al registrar background sync:', error);
        }
    }
}

// Exportar para uso en otros módulos
window.registerBackgroundSync = registerBackgroundSync;

// Toast helper (duplicado aquí para independencia)
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

console.log('📝 SW Register script loaded');
