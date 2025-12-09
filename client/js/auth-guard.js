/* ======================================
   AUTH-GUARD.JS - Middleware de Autenticación
   Valida autenticación y roles
   ====================================== */

import api from './api.js';
import { USER_ROLES } from './config.js';

/**
 * Verifica autenticación y redirige si no está logueado
 * @param {string} redirectUrl - URL de redirección (default: /index.html)
 * @returns {Object|null} userData o null si no autenticado
 */
export function requireAuth(redirectUrl = '/index.html') {
    if (!api.isAuthenticated()) {
        window.location.href = redirectUrl;
        return null;
    }
    return api.getUserData();
}

/**
 * Verifica que el usuario tenga un rol específico
 * @param {string|Array<string>} allowedRoles - Rol o array de roles permitidos
 * @param {string} redirectUrl - URL de redirección si no tiene permiso
 * @returns {Object|null} userData o null si no tiene permiso
 */
export function requireRole(allowedRoles, redirectUrl = '/index.html') {
    const userData = requireAuth(redirectUrl);
    if (!userData) return null;
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(userData.role)) {
        console.warn(`Acceso denegado: Se requiere rol ${roles.join(' o ')}`);
        window.location.href = redirectUrl;
        return null;
    }
    
    return userData;
}

/**
 * Inicialización estándar para páginas mucama
 * @returns {Object} userData
 */
export function initMucamaPage() {
    const userData = requireRole(USER_ROLES.MAID);
    if (!userData) return null;
    
    // Setup común para páginas mucama
    setupLogout();
    displayUserName(userData);
    
    return userData;
}

/**
 * Inicialización estándar para páginas recepción
 * @param {boolean} adminOnly - Si requiere solo ADMIN (default: false)
 * @returns {Object} userData
 */
export function initRecepcionPage(adminOnly = false) {
    const allowedRoles = adminOnly ? 
        [USER_ROLES.ADMIN] : 
        [USER_ROLES.ADMIN, USER_ROLES.RECEPTION];
    
    const userData = requireRole(allowedRoles);
    if (!userData) return null;
    
    // Setup común para páginas recepción
    setupLogout();
    displayUserName(userData, '#userNameSidebar');
    
    return userData;
}

/**
 * Configura botón de logout
 * @param {string} selector - Selector del botón logout (default: #logoutBtn)
 */
export function setupLogout(selector = '#logoutBtn') {
    const logoutBtn = document.querySelector(selector);
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            api.logout();
            window.location.href = '/index.html';
        });
    }
}

/**
 * Muestra nombre de usuario en el elemento especificado
 * @param {Object} userData - Datos del usuario
 * @param {string} selector - Selector del elemento (default: #userNameBadge)
 */
export function displayUserName(userData, selector = '#userNameBadge') {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = userData.name || userData.username;
    }
}

/**
 * Verifica si el usuario actual tiene un rol específico
 * @param {string} role - Rol a verificar
 * @returns {boolean} True si tiene el rol
 */
export function hasRole(role) {
    const userData = api.getUserData();
    return userData && userData.role === role;
}

/**
 * Verifica si el usuario es admin
 * @returns {boolean} True si es admin
 */
export function isAdmin() {
    return hasRole(USER_ROLES.ADMIN);
}

/**
 * Verifica si el usuario es recepción
 * @returns {boolean} True si es recepción
 */
export function isReception() {
    return hasRole(USER_ROLES.RECEPTION);
}

/**
 * Verifica si el usuario es mucama
 * @returns {boolean} True si es mucama
 */
export function isMaid() {
    return hasRole(USER_ROLES.MAID);
}

export default {
    requireAuth,
    requireRole,
    initMucamaPage,
    initRecepcionPage,
    setupLogout,
    displayUserName,
    hasRole,
    isAdmin,
    isReception,
    isMaid
};
