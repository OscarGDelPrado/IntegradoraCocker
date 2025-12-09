/* ======================================
   SERVICE WORKER - PWA con Offline Support
   Estrategia: Network First con Cache Fallback
   Cache API + Push Notifications
   ====================================== */

const CACHE_NAME = 'hotel-manager-v1';
const API_CACHE = 'hotel-api-v1';

// Archivos esenciales para cachear (Shell de la app)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/common.css',
    '/css/login.css',
    '/js/api.js',
    '/js/config.js',
    '/mucama/index.html',
    '/mucama/css/mucama.css',
    '/mucama/js/mucama-home.js',
    '/mucama/js/db-service.js',
    '/recepcion/index.html',
    '/recepcion/css/recepcion.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// INSTALL: Cachear recursos estáticos
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('[SW] Cache installation failed:', error);
            })
    );
    
    // Activar inmediatamente sin esperar
    self.skipWaiting();
});

// ACTIVATE: Limpiar caches antiguas
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    
    // Tomar control inmediatamente
    return self.clients.claim();
});

// FETCH: Estrategia Network First con Cache Fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar requests no-HTTP (chrome-extension, etc)
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Para requests POST/PUT/PATCH/DELETE, intentar red y si falla, simplemente fallar
    // (no cachear, dejamos que la app maneje offline con IndexedDB)
    if (request.method !== 'GET') {
        event.respondWith(
            fetch(request).catch(error => {
                console.log('Fetch failed for non-GET request, app will handle offline:', error);
                return Promise.reject(error);
            })
        );
        return;
    }
    
    // Estrategia diferenciada por tipo de recurso
    if (url.pathname.startsWith('/api/')) {
        // API: Network First con timeout, luego Cache
        event.respondWith(networkFirstStrategy(request));
    } else {
        // Estáticos: Cache First, luego Network
        event.respondWith(cacheFirstStrategy(request));
    }
});

// Estrategia 1: Network First (para APIs)
async function networkFirstStrategy(request) {
    try {
        // Intentar red con timeout de 5 segundos
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 5000)
        );
        
        const response = await Promise.race([networkPromise, timeoutPromise]);
        
        // Si es exitosa, cachear para uso offline (solo GET requests)
        if (response && response.ok && request.method === 'GET') {
            const cache = await caches.open(API_CACHE);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        
        // Fallback a cache
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        // Si no hay cache, retornar error offline
        return new Response(
            JSON.stringify({ 
                error: 'Offline', 
                message: 'No network and no cache available' 
            }),
            { 
                status: 503, 
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Estrategia 2: Cache First (para recursos estáticos)
async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    
    if (cached) {
        // Actualizar cache en background
        fetch(request).then((response) => {
            if (response && response.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, response);
                });
            }
        }).catch(() => {
            // Ignorar errores de actualización en background
        });
        
        return cached;
    }
    
    // Si no está en cache, intentar red
    try {
        const response = await fetch(request);
        
        if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        // Fallback page offline
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }
        
        return new Response('Offline', { status: 503 });
    }
}

// ============ PUSH NOTIFICATIONS ============

// PUSH: Manejar notificaciones push del servidor
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);
    
    let notificationData = {
        title: 'Hotel Manager',
        body: 'Nueva notificación',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: 'notification',
        requireInteraction: false
    };
    
    // Parsear datos del push
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                ...notificationData,
                title: data.title || notificationData.title,
                body: data.message || data.body || notificationData.body,
                data: data.data || {},
                tag: data.type || 'notification'
            };
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// NOTIFICATION CLICK: Abrir la app al hacer clic
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    
    event.notification.close();
    
    // Determinar URL basada en el tipo de notificación
    let urlToOpen = '/';
    
    if (event.notification.data) {
        const { type } = event.notification.data;
        
        if (type === 'INCIDENT_CREATED' || type === 'INCIDENT_RESOLVED') {
            urlToOpen = '/mucama/incidents.html';
        } else if (type === 'ROOM_UPDATED') {
            urlToOpen = '/mucama/index.html';
        }
    }
    
    // Abrir o enfocar ventana existente
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si ya hay una ventana abierta, enfocarla
                for (let client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Si no, abrir nueva ventana
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// SYNC: Background sync para operaciones pendientes
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-pending-changes' || event.tag === 'sync-pending-incidents') {
        event.waitUntil(syncPendingChanges());
    }
});

async function syncPendingChanges() {
    console.log('🔄 [SW] Iniciando sincronización de cambios pendientes...');
    
    try {
        // Obtener todos los clientes (páginas abiertas)
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        
        if (clients.length === 0) {
            console.log('⚠️ [SW] No hay clientes activos, no se puede sincronizar');
            return;
        }
        
        console.log(`👥 [SW] ${clients.length} cliente(s) activo(s), solicitando sincronización...`);
        
        // Enviar mensaje a todos los clientes para que procesen la cola
        for (const client of clients) {
            client.postMessage({
                type: 'PROCESS_SYNC_QUEUE',
                source: 'service-worker',
                timestamp: Date.now()
            });
        }
        
        console.log('✅ [SW] Solicitud de sincronización enviada a clientes');
        
    } catch (error) {
        console.error('❌ [SW] Error en syncPendingChanges:', error);
    }
}

// MESSAGE: Comunicación con la app principal
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CACHE_URLS') {
        const urls = event.data.urls;
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.addAll(urls))
        );
    }
    
    if (event.data.type === 'CHECK_SYNC_QUEUE') {
        console.log('📬 [SW] Recibido mensaje para revisar cola de sincronización');
        event.waitUntil(syncPendingChanges());
    }
    
    if (event.data.type === 'NETWORK_ONLINE') {
        console.log('🌐 [SW] Red disponible, revisando cola de sincronización');
        event.waitUntil(syncPendingChanges());
    }
});

console.log('[SW] Service Worker script loaded');
