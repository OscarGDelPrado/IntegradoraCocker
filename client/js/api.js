/* ======================================
   API.JS - Servicio HTTP para Backend
   Conecta con Spring Boot REST API
   ====================================== */

import { API_URL, STORAGE_KEYS } from './config.js';

class ApiService {
    constructor() {
        this.baseURL = API_URL;
    }

    // Obtener token JWT del localStorage (generado por JwtService.java)
    getAuthToken() {
        return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    }

    // Headers con autenticación JWT (JwtAuthenticationFilter.java valida)
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        };

        if (includeAuth) {
            const token = this.getAuthToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    // Método genérico para requests
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: this.getHeaders(options.auth !== false)
            });

            // Si token inválido (401) redirigir a login
            if (response.status === 401) {
                this.logout();
                window.location.href = '/index.html';
                throw new Error('Sesión expirada');
            }

            if (!response.ok) {
                // Intentar obtener el mensaje de error del backend
                let errorMessage = response.statusText;
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMessage = errorText;
                    }
                } catch (e) {
                    // Si no se puede leer el texto, usar statusText
                }
                
                const error = new Error(`HTTP ${response.status}: ${errorMessage}`);
                error.response = errorMessage;
                error.status = response.status;
                throw error;
            }

            // Intentar parsear como JSON, si falla retornar texto
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // GET request
    async get(url) {
        return this.request(url, { method: 'GET' });
    }

    // POST request
    async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // PATCH request
    async patch(url, data) {
        return this.request(url, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }

    // Login sin autenticación (endpoint público en SecurityConfig)
    async login(username, password) {
        return this.request(`${this.baseURL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            auth: false
        });
    }

    // Guardar token y datos de usuario tras login exitoso
    saveAuth(authResponse) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify({
            userId: authResponse.userId,
            username: authResponse.username,
            name: authResponse.name,
            role: authResponse.role
        }));
    }

    // Obtener datos de usuario actual
    getUserData() {
        const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        return data ? JSON.parse(data) : null;
    }

    // Logout
    logout() {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }

    // Verificar si usuario está autenticado
    isAuthenticated() {
        return !!this.getAuthToken();
    }
}

export default new ApiService();
