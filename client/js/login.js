/* ======================================
   LOGIN.JS - Autenticación y Redirección
   Backend: AuthController.login()
   ====================================== */

import api from './api.js';
import { USER_ROLES } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Si ya está autenticado, redirigir según rol
    if (api.isAuthenticated()) {
        redirectByRole();
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Ingrese usuario y contraseña');
            return;
        }

        try {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Iniciando...';
            hideError();

            // POST /api/auth/login - AuthController.login()
            // Autentica con AuthenticationManager y genera JWT con JwtService
            const response = await api.login(username, password);
            
            // Guardar token JWT y datos de usuario
            api.saveAuth(response);

            // Redirigir según rol del usuario (User.Role enum)
            redirectByRole(response.role);

        } catch (error) {
            console.error('Login error:', error);
            showError('Usuario o contraseña incorrectos');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
    }

    function hideError() {
        errorMessage.classList.add('d-none');
    }

    function redirectByRole(role = null) {
        const userData = api.getUserData();
        const userRole = role || userData?.role;

        // Redirigir según rol: MAID -> móvil, ADMIN/RECEPTION -> desktop
        switch (userRole) {
            case USER_ROLES.MAID:
                window.location.href = '/mucama/index.html';
                break;
            case USER_ROLES.RECEPTION:
            case USER_ROLES.ADMIN:
                window.location.href = '/recepcion/index.html';
                break;
            default:
                console.error('Rol desconocido:', userRole);
        }
    }
});
