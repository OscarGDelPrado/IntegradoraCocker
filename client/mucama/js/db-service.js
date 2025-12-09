/* ======================================
   DB-SERVICE.JS - PouchDB Offline Database
   Maneja sincronización bidireccional con backend
   ====================================== */

import { STORAGE_KEYS, ENDPOINTS } from '../../js/config.js';

class DatabaseService {
    constructor() {
        // Bases de datos locales PouchDB
        this.roomsDB = null;
        this.incidentsDB = null;
        this.syncDB = null;
        
        // Estado de conexión
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.pendingChanges = [];
        
        this.init();
    }

    async init() {
        try {
            // Inicializar PouchDB (se carga desde CDN en HTML)
            if (typeof PouchDB === 'undefined') {
                console.warn('PouchDB no disponible, funcionando solo online');
                return;
            }

            // Crear bases de datos locales
            this.roomsDB = new PouchDB('hotel_rooms');
            this.incidentsDB = new PouchDB('hotel_incidents');
            this.syncDB = new PouchDB('hotel_sync_queue');

            console.log('✅ PouchDB inicializado correctamente');

            // Configurar listeners de conectividad
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
            
            // Escuchar mensajes del Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log('📬 [DB] Mensaje recibido del SW:', event.data);
                
                if (event.data.type === 'SYNC_INCIDENT') {
                    this.processSyncQueue();
                }
            });

            // Sincronizar si hay conexión
            if (this.isOnline) {
                await this.syncAll();
            }

        } catch (error) {
            console.error('❌ Error inicializando PouchDB:', error);
        }
    }

    // === GESTIÓN DE HABITACIONES ===

    async saveRoomsLocal(rooms) {
        if (!this.roomsDB) return;
        
        try {
            const docs = rooms.map(room => ({
                _id: `room_${room.id}`,
                ...room,
                localUpdated: Date.now()
            }));

            for (const doc of docs) {
                try {
                    const existing = await this.roomsDB.get(doc._id);
                    doc._rev = existing._rev;
                } catch (e) {
                    // Documento no existe, es nuevo
                }
                await this.roomsDB.put(doc);
            }

            console.log(`💾 ${rooms.length} habitaciones guardadas localmente`);
        } catch (error) {
            console.error('Error guardando habitaciones:', error);
        }
    }

    async getRoomsLocal(maidId = null) {
        if (!this.roomsDB) return [];
        
        try {
            const result = await this.roomsDB.allDocs({ include_docs: true });
            let rooms = result.rows.map(row => row.doc);

            // Filtrar por mucama si se especifica
            if (maidId) {
                rooms = rooms.filter(r => r.assignedTo?.id === maidId);
            }

            return rooms;
        } catch (error) {
            console.error('Error leyendo habitaciones:', error);
            return [];
        }
    }

    async updateRoomStatusLocal(roomId, status) {
        if (!this.roomsDB) return null;

        try {
            const doc = await this.roomsDB.get(`room_${roomId}`);
            doc.status = status;
            doc.updatedAt = new Date().toISOString();
            doc.localUpdated = Date.now();
            doc.pendingSync = true;

            await this.roomsDB.put(doc);

            // Agregar a cola de sincronización
            await this.addToSyncQueue({
                type: 'ROOM_STATUS',
                action: 'PATCH',
                endpoint: ENDPOINTS.ROOM_STATUS(roomId),
                data: status,
                roomId: roomId,
                timestamp: Date.now()
            });

            console.log(`💾 Estado de habitación ${roomId} actualizado localmente`);
            return doc;
        } catch (error) {
            console.error('Error actualizando estado local:', error);
            return null;
        }
    }

    // === GESTIÓN DE INCIDENCIAS ===

    async saveIncidentsLocal(incidents) {
        if (!this.incidentsDB) return;
        
        try {
            const docs = incidents.map(inc => ({
                _id: `incident_${inc.id || Date.now()}_${Math.random()}`,
                ...inc,
                localUpdated: Date.now()
            }));

            for (const doc of docs) {
                try {
                    const existing = await this.incidentsDB.get(doc._id);
                    doc._rev = existing._rev;
                } catch (e) {
                    // Documento no existe
                }
                await this.incidentsDB.put(doc);
            }

            console.log(`💾 ${incidents.length} incidencias guardadas localmente`);
        } catch (error) {
            console.error('Error guardando incidencias:', error);
        }
    }

    async getIncidentsLocal(maidId = null) {
        if (!this.incidentsDB) return [];
        
        try {
            const result = await this.incidentsDB.allDocs({ include_docs: true });
            let incidents = result.rows.map(row => row.doc);

            // Filtrar por mucama si se especifica
            if (maidId) {
                incidents = incidents.filter(i => i.reportedBy?.id === maidId);
            }

            return incidents;
        } catch (error) {
            console.error('Error leyendo incidencias:', error);
            return [];
        }
    }

    async createIncidentLocal(incidentData) {
        if (!this.incidentsDB) {
            console.error('❌ incidentsDB no disponible');
            return null;
        }

        try {
            const doc = {
                _id: `incident_temp_${Date.now()}`,
                ...incidentData,
                createdAt: new Date().toISOString(),
                localCreated: true,
                pendingSync: true,
                localUpdated: Date.now()
            };

            await this.incidentsDB.put(doc);
            console.log('💾 Incidencia guardada en IndexedDB:', doc._id);

            // Agregar a cola de sincronización
            const queueItem = {
                type: 'INCIDENT_CREATE',
                action: 'POST',
                endpoint: ENDPOINTS.INCIDENTS,
                data: incidentData,
                tempId: doc._id,
                timestamp: Date.now()
            };
            
            console.log('📤 Agregando incidencia a cola de sincronización:', queueItem);
            await this.addToSyncQueue(queueItem);

            console.log('✅ Incidencia creada localmente, pendiente de sincronización');
            return doc;
        } catch (error) {
            console.error('Error creando incidencia local:', error);
            return null;
        }
    }

    // === COLA DE SINCRONIZACIÓN ===

    async addToSyncQueue(item) {
        if (!this.syncDB) {
            console.error('❌ syncDB no disponible');
            return;
        }

        try {
            const queueDoc = {
                ...item,
                addedAt: Date.now(),
                synced: false,
                attempts: 0
            };
            
            const result = await this.syncDB.post(queueDoc);
            console.log(`📤 Cambio agregado a cola de sincronización:`, {
                type: item.type,
                id: result.id,
                rev: result.rev
            });

            this.pendingChanges.push(item);
            
            // Registrar tarea de background sync con el Service Worker
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    if ('sync' in registration) {
                        await registration.sync.register('sync-pending-changes');
                        console.log('✅ Background sync registrado con el SW');
                    }
                } catch (error) {
                    console.warn('⚠️ No se pudo registrar background sync:', error);
                }
            }

            // Intentar sincronizar si hay conexión
            if (navigator.onLine && !this.syncInProgress) {
                console.log('🔄 Hay conexión, intentando sincronizar inmediatamente...');
                await this.processSyncQueue();
            } else {
                console.log('📴 Sin conexión o sincronización en progreso, se sincronizará más tarde');
            }
        } catch (error) {
            console.error('❌ Error agregando a cola:', error);
        }
    }

    async processSyncQueue() {
        if (!this.syncDB) {
            console.log('⚠️ SyncDB no disponible');
            return;
        }
        
        if (this.syncInProgress) {
            console.log('⚠️ Sincronización ya en progreso');
            return;
        }
        
        // Verificar conectividad real, no solo la bandera
        if (!navigator.onLine) {
            console.log('⚠️ Sin conexión (navigator.onLine=false), sincronización omitida');
            return;
        }

        this.syncInProgress = true;
        console.log('🔄 Procesando cola de sincronización...', {
            isOnline: this.isOnline,
            navigatorOnline: navigator.onLine
        });

        try {
            const result = await this.syncDB.allDocs({ include_docs: true });
            const pending = result.rows
                .map(row => row.doc)
                .filter(doc => !doc.synced)
                .sort((a, b) => a.addedAt - b.addedAt);

            console.log(`📋 ${pending.length} cambios pendientes de sincronización`);
            
            if (pending.length === 0) {
                console.log('✅ No hay cambios pendientes');
            }

            for (const item of pending) {
                try {
                    console.log(`🔄 Sincronizando item:`, {
                        type: item.type,
                        endpoint: item.endpoint,
                        id: item._id
                    });
                    
                    await this.syncItem(item);
                    
                    // Marcar como sincronizado
                    item.synced = true;
                    item.syncedAt = Date.now();
                    await this.syncDB.put(item);

                    console.log(`✅ Sincronizado exitosamente: ${item.type}`);
                } catch (error) {
                    console.error(`❌ Error sincronizando ${item.type}:`, error);
                    console.error('Detalles del error:', error.message, error.stack);
                    // No marcamos como sincronizado, se reintentará
                }
            }

            // Limpiar items sincronizados antiguos (más de 7 días)
            await this.cleanOldSyncedItems();

        } catch (error) {
            console.error('Error procesando cola:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    async syncItem(item) {
        // Importar API dinámicamente para evitar circulares
        const apiModule = await import('../../js/api.js');
        const api = apiModule.default;

        switch (item.type) {
            case 'ROOM_STATUS':
                await api.patch(item.endpoint, item.data);
                // Actualizar documento local
                const roomId = item.roomId;
                if (roomId && this.roomsDB) {
                    try {
                        const roomDoc = await this.roomsDB.get(`room_${roomId}`);
                        delete roomDoc.pendingSync;
                        await this.roomsDB.put(roomDoc);
                    } catch (err) {
                        console.log('Documento de habitación no encontrado localmente:', err);
                    }
                }
                break;

            case 'INCIDENT_CREATE':
                console.log('📤 Enviando incidencia al servidor:', item.endpoint);
                const newIncident = await api.post(item.endpoint, item.data);
                console.log('✅ Incidencia creada en servidor:', newIncident);
                
                // Reemplazar documento temporal con el real
                if (item.tempId && newIncident.id) {
                    try {
                        const tempDoc = await this.incidentsDB.get(item.tempId);
                        await this.incidentsDB.remove(tempDoc);
                        console.log('🗑️ Documento temporal eliminado:', item.tempId);
                    } catch (err) {
                        console.warn('Documento temporal no encontrado:', item.tempId, err);
                    }
                    
                    await this.incidentsDB.put({
                        _id: `incident_${newIncident.id}`,
                        ...newIncident,
                        localUpdated: Date.now()
                    });
                }
                break;

            default:
                console.warn(`Tipo de sincronización desconocido: ${item.type}`);
        }
    }

    async cleanOldSyncedItems() {
        if (!this.syncDB) return;

        try {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const result = await this.syncDB.allDocs({ include_docs: true });
            
            for (const row of result.rows) {
                const doc = row.doc;
                if (doc.synced && doc.syncedAt < sevenDaysAgo) {
                    await this.syncDB.remove(doc);
                }
            }
        } catch (error) {
            console.error('Error limpiando items antiguos:', error);
        }
    }

    // === SINCRONIZACIÓN COMPLETA ===

    async syncAll() {
        if (!this.isOnline) {
            console.log('⚠️ Sin conexión, sincronización omitida');
            return;
        }

        console.log('🔄 Iniciando sincronización completa...');

        try {
            // Importar API
            const apiModule = await import('../../js/api.js');
            const api = apiModule.default;

            const userData = api.getUserData();
            if (!userData) return;

            // Sincronizar habitaciones
            if (userData.role === 'MAID') {
                const rooms = await api.get(ENDPOINTS.ROOMS_BY_MAID(userData.userId));
                await this.saveRoomsLocal(rooms);

                const incidents = await api.get(ENDPOINTS.INCIDENTS_BY_MAID(userData.userId));
                await this.saveIncidentsLocal(incidents);
            }

            // Procesar cola de cambios pendientes
            await this.processSyncQueue();

            console.log('✅ Sincronización completa finalizada');
        } catch (error) {
            console.error('❌ Error en sincronización completa:', error);
        }
    }

    // === MANEJO DE CONECTIVIDAD ===

    handleOnline() {
        console.log('✅ Conexión restaurada');
        this.isOnline = true;
        this.showConnectivityToast('Conexión restaurada. Sincronizando...', 'success');
        
        // Notificar al Service Worker que la red está disponible
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            console.log('📡 [DB] Notificando al SW que la red está disponible');
            navigator.serviceWorker.controller.postMessage({
                type: 'NETWORK_ONLINE'
            });
        }
        
        // Procesar cola de sincronización
        this.processSyncQueue();
        this.syncAll();
    }

    handleOffline() {
        console.log('⚠️ Sin conexión a internet');
        this.isOnline = false;
        this.showConnectivityToast('Sin conexión. Los cambios se guardarán localmente.', 'warning');
    }

    showConnectivityToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
        toast.style.zIndex = '9999';
        toast.style.maxWidth = '90%';
        toast.innerHTML = `
            <strong>${type === 'success' ? '🌐' : '📵'}</strong> ${message}
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 4000);
    }

    // === ESTADO Y ESTADÍSTICAS ===

    async getOfflineStats() {
        if (!this.syncDB) return null;

        try {
            const result = await this.syncDB.allDocs({ include_docs: true });
            const pending = result.rows.filter(row => !row.doc.synced);

            return {
                isOnline: this.isOnline,
                pendingChanges: pending.length,
                syncInProgress: this.syncInProgress,
                roomsCount: this.roomsDB ? (await this.roomsDB.info()).doc_count : 0,
                incidentsCount: this.incidentsDB ? (await this.incidentsDB.info()).doc_count : 0
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return null;
        }
    }

    // === LIMPIAR DATOS (LOGOUT) ===

    async clearAllData() {
        try {
            if (this.roomsDB) await this.roomsDB.destroy();
            if (this.incidentsDB) await this.incidentsDB.destroy();
            if (this.syncDB) await this.syncDB.destroy();

            console.log('🗑️ Bases de datos locales eliminadas');
        } catch (error) {
            console.error('Error limpiando datos:', error);
        }
    }
}

// Exportar instancia única (singleton)
const dbService = new DatabaseService();
export default dbService;
