/* ======================================
   CONSTANTS.JS - Constantes de la Aplicación
   Valores reutilizables en toda la app
   ====================================== */

// Tiempos y duraciones
export const TIMEOUTS = {
    TOAST_DURATION: 3000,
    AUTO_REFRESH_ROOMS: 30000,      // 30 segundos
    AUTO_REFRESH_INCIDENTS: 30000,   // 30 segundos
    AUTO_REFRESH_TEAM: 60000,        // 60 segundos
    WEBSOCKET_RECONNECT: 3000,       // 3 segundos
    API_TIMEOUT: 5000,               // 5 segundos
    QR_CODE_EXPIRY_DAYS: 30
};

// Límites y validación
export const LIMITS = {
    MAX_PHOTOS_PER_INCIDENT: 3,
    MAX_PHOTO_SIZE_MB: 0.5,
    IMAGE_MAX_DIMENSION: 1024,
    IMAGE_QUALITY: 0.7,
    MIN_PASSWORD_LENGTH: 4,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 20
};

// Mensajes estándar
export const MESSAGES = {
    // Éxito
    SUCCESS: {
        LOGIN: 'Sesión iniciada correctamente',
        LOGOUT: 'Sesión cerrada',
        ROOM_UPDATED: 'Habitación actualizada correctamente',
        INCIDENT_CREATED: 'Incidencia registrada correctamente',
        INCIDENT_RESOLVED: 'Incidencia resuelta correctamente',
        USER_CREATED: 'Usuario creado correctamente',
        USER_UPDATED: 'Usuario actualizado correctamente',
        USER_DELETED: 'Usuario eliminado correctamente',
        SYNC_COMPLETE: 'Sincronización completada',
        COPIED_TO_CLIPBOARD: 'Copiado al portapapeles'
    },
    
    // Errores
    ERROR: {
        LOGIN_FAILED: 'Usuario o contraseña incorrectos',
        NETWORK_ERROR: 'Error de conexión. Verifica tu internet',
        PERMISSION_DENIED: 'No tienes permisos para esta acción',
        INVALID_DATA: 'Datos inválidos o incompletos',
        SERVER_ERROR: 'Error del servidor. Intenta más tarde',
        NOT_FOUND: 'Recurso no encontrado',
        LOAD_ROOMS: 'Error al cargar habitaciones',
        LOAD_INCIDENTS: 'Error al cargar incidencias',
        LOAD_USERS: 'Error al cargar usuarios',
        SAVE_FAILED: 'Error al guardar',
        DELETE_FAILED: 'Error al eliminar',
        CAMERA_ACCESS: 'No se pudo acceder a la cámara',
        INVALID_QR: 'Código QR inválido',
        QR_EXPIRED: 'Este código QR ha caducado',
        OFFLINE_NO_CACHE: 'Sin conexión y sin datos guardados'
    },
    
    // Advertencias
    WARNING: {
        OFFLINE_MODE: '📵 Modo offline - usando datos guardados',
        OFFLINE_SAVE: '📵 Guardado localmente. Se sincronizará cuando haya conexión',
        PENDING_CHANGES: 'Hay cambios pendientes de sincronizar',
        SELECT_ROOM: 'Seleccione una habitación',
        FILL_REQUIRED: 'Complete todos los campos requeridos',
        MAX_PHOTOS: 'Máximo 3 fotos permitidas',
        CONFIRM_DELETE: '¿Está seguro de eliminar este elemento?',
        NO_INTERNET: 'Sin conexión a internet'
    },
    
    // Información
    INFO: {
        LOADING: 'Cargando...',
        SYNCING: 'Sincronizando...',
        PROCESSING: 'Procesando...',
        NO_RESULTS: 'No hay resultados',
        NO_DATA: 'No hay datos disponibles',
        WEBSOCKET_CONNECTED: '✅ Conectado en tiempo real',
        WEBSOCKET_DISCONNECTED: '❌ Desconectado',
        UPDATE_AVAILABLE: '📦 Hay una actualización disponible',
        NOTIFICATIONS_ENABLED: 'Notificaciones activadas',
        PWA_INSTALLABLE: 'Puedes instalar esta app'
    }
};

// Iconos y emojis
export const ICONS = {
    ROOM: '🚪',
    INCIDENT: '⚠️',
    USER: '👤',
    ADMIN: '👑',
    RECEPTION: '🏨',
    MAID: '🧹',
    QR: '📱',
    NOTIFICATION: '🔔',
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    OFFLINE: '📵',
    ONLINE: '🌐',
    SYNC: '🔄',
    CLEAN: '✨',
    DIRTY: '🧼',
    OCCUPIED: '🚫',
    MAINTENANCE: '🔧'
};

// Clases CSS comunes
export const CSS_CLASSES = {
    BADGE: {
        SUCCESS: 'badge bg-success',
        DANGER: 'badge bg-danger',
        WARNING: 'badge bg-warning text-dark',
        INFO: 'badge bg-info',
        SECONDARY: 'badge bg-secondary',
        PRIMARY: 'badge bg-primary'
    },
    ALERT: {
        SUCCESS: 'alert alert-success',
        DANGER: 'alert alert-danger',
        WARNING: 'alert alert-warning',
        INFO: 'alert alert-info'
    },
    BUTTON: {
        PRIMARY: 'btn btn-primary',
        SECONDARY: 'btn btn-secondary',
        SUCCESS: 'btn btn-success',
        DANGER: 'btn btn-danger',
        WARNING: 'btn btn-warning',
        INFO: 'btn btn-info'
    }
};

// Reglas de validación
export const VALIDATION = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    USERNAME_REGEX: /^[a-zA-Z0-9_-]{3,20}$/,
    PHONE_REGEX: /^[0-9]{10}$/,
    ROOM_NUMBER_REGEX: /^[0-9]{1,4}$/
};

// Estados de carga
export const LOADING_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error'
};

// Nombres de eventos personalizados
export const CUSTOM_EVENTS = {
    ROOM_UPDATED: 'room-updated',
    INCIDENT_CREATED: 'incident-created',
    INCIDENT_RESOLVED: 'incident-resolved',
    USER_UPDATED: 'user-updated',
    SYNC_START: 'sync-start',
    SYNC_COMPLETE: 'sync-complete',
    CONNECTIVITY_CHANGE: 'connectivity-change',
    WEBSOCKET_CONNECTED: 'websocket-connected',
    WEBSOCKET_DISCONNECTED: 'websocket-disconnected'
};

// Configuración de PouchDB
export const POUCHDB_CONFIG = {
    DB_NAMES: {
        ROOMS: 'hotel_rooms',
        INCIDENTS: 'hotel_incidents',
        SYNC_QUEUE: 'hotel_sync_queue'
    },
    BATCH_SIZE: 100,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000
};

// Configuración de WebSocket
export const WEBSOCKET_CONFIG = {
    TOPICS: {
        ROOMS: '/topic/rooms',
        INCIDENTS: '/topic/incidents',
        NOTIFICATIONS: '/topic/notifications'
    },
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 3000
};

// Configuración de Service Worker
export const SW_CONFIG = {
    CACHE_NAME: 'hotel-manager-v1',
    API_CACHE_NAME: 'hotel-api-v1',
    CACHE_STRATEGY: {
        NETWORK_FIRST: 'network-first',
        CACHE_FIRST: 'cache-first',
        NETWORK_ONLY: 'network-only',
        CACHE_ONLY: 'cache-only'
    }
};

// Mapeo de severidad de incidencias
export const SEVERITY_MAP = {
    LOW: { text: 'Baja', class: 'bg-info', icon: 'ℹ️' },
    MEDIUM: { text: 'Media', class: 'bg-warning', icon: '⚠️' },
    HIGH: { text: 'Alta', class: 'bg-danger', icon: '❌' }
};

// Mapeo de estados de incidencias
export const INCIDENT_STATUS_MAP = {
    OPEN: { text: 'Abierta', class: 'bg-warning text-dark', icon: '⚠️' },
    RESOLVED: { text: 'Resuelta', class: 'bg-success', icon: '✅' },
    IN_PROGRESS: { text: 'En Progreso', class: 'bg-info', icon: '🔄' }
};

// Mapeo de estados de habitaciones
export const ROOM_STATUS_MAP = {
    CLEAN: { text: 'Limpia', class: 'bg-success', icon: '✨' },
    DIRTY: { text: 'Sucia', class: 'bg-warning text-dark', icon: '🧼' },
    OCCUPIED: { text: 'Ocupada', class: 'bg-danger', icon: '🚫' },
    MAINTENANCE: { text: 'Mantenimiento', class: 'bg-secondary', icon: '🔧' }
};

// Exportar todo
export default {
    TIMEOUTS,
    LIMITS,
    MESSAGES,
    ICONS,
    CSS_CLASSES,
    VALIDATION,
    LOADING_STATES,
    CUSTOM_EVENTS,
    POUCHDB_CONFIG,
    WEBSOCKET_CONFIG,
    SW_CONFIG,
    SEVERITY_MAP,
    INCIDENT_STATUS_MAP,
    ROOM_STATUS_MAP
};
