/* ======================================
   CONFIG.JS - Configuración Global
   ====================================== */

// Backend API URL - Conecta con Spring Boot (SecurityConfig permite CORS desde localhost:5173)
export const API_URL = 'https://nonemotive-suggestively-josphine.ngrok-free.dev/api';

// Endpoints del Backend (Spring Boot Controllers)
export const ENDPOINTS = {
    // AuthController.java - /api/auth
    LOGIN: `${API_URL}/auth/login`,           // POST - Autenticación JWT
    REGISTER: `${API_URL}/auth/register`,     // POST - Registro usuario
    VERIFY: `${API_URL}/auth/verify`,         // GET - Verificar token
    
    // RoomController.java - /api/rooms
    ROOMS: `${API_URL}/rooms`,                // GET/POST - Todas las habitaciones
    ROOM_BY_ID: (id) => `${API_URL}/rooms/${id}`,              // GET/PUT/DELETE
    ROOMS_BY_BUILDING: (bid) => `${API_URL}/rooms/building/${bid}`,
    ROOMS_BY_STATUS: (status) => `${API_URL}/rooms/status/${status}`,
    ROOMS_BY_MAID: (maidId) => `${API_URL}/rooms/maid/${maidId}`,  // Habitaciones asignadas a mucama
    ROOM_STATUS: (id) => `${API_URL}/rooms/${id}/status`,       // PATCH - Actualizar estado
    ROOM_ASSIGN: (id) => `${API_URL}/rooms/${id}/assign`,       // PATCH - Reasignar habitación
    ROOMS_RESET: `${API_URL}/rooms/reset`,                      // POST - Reinicio manual diario
    
    // IncidentController.java - /api/incidents
    INCIDENTS: `${API_URL}/incidents`,        // GET/POST - Todas las incidencias
    INCIDENT_BY_ID: (id) => `${API_URL}/incidents/${id}`,      // GET/PUT/DELETE
    INCIDENTS_BY_ROOM: (rid) => `${API_URL}/incidents/room/${rid}`,
    INCIDENTS_BY_MAID: (mid) => `${API_URL}/incidents/maid/${mid}`,
    INCIDENTS_BY_STATUS: (status) => `${API_URL}/incidents/status/${status}`,
    INCIDENT_RESOLVE: (id) => `${API_URL}/incidents/${id}/resolve`, // PATCH - Resolver incidencia
    
    // UserController.java - /api/users
    USERS: `${API_URL}/users`,                // GET/POST - Todos los usuarios
    USER_BY_ID: (id) => `${API_URL}/users/${id}`,              // GET/PUT/DELETE
    USERS_BY_ROLE: (role) => `${API_URL}/users/role/${role}`,  // GET - Por rol
    USERS_BY_HOTEL: (hid) => `${API_URL}/users/hotel/${hid}`,  // GET - Por hotel
    USERS_ACTIVE: `${API_URL}/users/active`,  // GET - Solo activos
    USER_ACTIVATE: (id) => `${API_URL}/users/${id}/activate`,  // PATCH - Activar/desactivar
};

// Estados de habitaciones (Room.RoomStatus enum en backend)
export const ROOM_STATUS = {
    CLEAN: 'CLEAN',       // Limpia
    DIRTY: 'DIRTY',       // Sucia
    OCCUPIED: 'OCCUPIED', // Ocupada
    BLOCKED: 'BLOCKED'    // Bloqueada (con incidencia activa)
};

// Estados de incidencias (Incident.IncidentStatus enum)
export const INCIDENT_STATUS = {
    OPEN: 'OPEN',         // Abierta
    RESOLVED: 'RESOLVED'  // Resuelta
};

// Severidades de incidencias (Incident.Severity enum)
export const INCIDENT_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
};

// Roles de usuario (User.Role enum)
export const USER_ROLES = {
    ADMIN: 'ADMIN',
    RECEPTION: 'RECEPTION',
    MAID: 'MAID'
};

// LocalStorage keys
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'hotel_auth_token',
    USER_DATA: 'hotel_user_data',
    OFFLINE_QUEUE: 'hotel_offline_queue'
};

// Configuración PouchDB (no implementado en backend, solo frontend offline)
export const POUCHDB_CONFIG = {
    LOCAL_DB: 'hotel_local_db',
    REMOTE_DB: null  // No hay CouchDB remoto en el backend actual
};
