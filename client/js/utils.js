/* ======================================
   UTILS.JS - Utilidades Compartidas
   Funciones comunes para evitar duplicación
   ====================================== */

// ============ NOTIFICACIONES ============

/**
 * Muestra un toast notification temporal
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'danger', 'warning', 'info'
 * @param {number} duration - Duración en ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    toast.style.zIndex = '9999';
    toast.style.maxWidth = '90%';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
}

/**
 * Muestra un toast con ícono
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duración en ms
 */
export function showToastWithIcon(message, type = 'info', duration = 3000) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const alertTypes = {
        success: 'success',
        error: 'danger',
        warning: 'warning',
        info: 'info'
    };
    
    showToast(`${icons[type]} ${message}`, alertTypes[type], duration);
}

// ============ FECHAS Y TIEMPO ============

/**
 * Formatea una fecha ISO a formato legible español
 * @param {string} dateString - Fecha en formato ISO
 * @returns {string} Fecha formateada
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formatea fecha en formato corto (sin hora)
 * @param {string} dateString - Fecha en formato ISO
 * @returns {string} Fecha formateada
 */
export function formatDateShort(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Calcula tiempo relativo (hace X horas/días)
 * @param {string} dateString - Fecha en formato ISO
 * @returns {string} Tiempo relativo
 */
export function getRelativeTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)} hrs`;
    return date.toLocaleDateString('es-ES');
}

// ============ VALIDACIÓN Y FORMATO ============

/**
 * Trunca texto largo con ellipsis
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
export function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Valida email
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
export function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Valida username (sin espacios ni caracteres especiales)
 * @param {string} username - Username a validar
 * @returns {boolean} True si es válido
 */
export function isValidUsername(username) {
    const regex = /^[a-zA-Z0-9_-]{3,20}$/;
    return regex.test(username);
}

/**
 * Limpia y sanitiza string
 * @param {string} str - String a limpiar
 * @returns {string} String limpio
 */
export function sanitizeString(str) {
    if (!str) return '';
    return str.trim().replace(/[<>]/g, '');
}

// ============ IMÁGENES ============

/**
 * Comprime y convierte imagen a base64
 * @param {File} file - Archivo de imagen
 * @param {number} maxDimension - Dimensión máxima (default: 1024)
 * @param {number} quality - Calidad JPEG (default: 0.7)
 * @returns {Promise<string>} Base64 string
 */
export function compressImageToBase64(file, maxDimension = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Resize si es muy grande
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            
            img.onerror = () => reject(new Error('Error loading image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Parsea JSON de fotos (para incidencias)
 * @param {string} photosJson - JSON string con array de fotos
 * @returns {Array<string>} Array de URLs base64
 */
export function parsePhotosJson(photosJson) {
    if (!photosJson) return [];
    try {
        return JSON.parse(photosJson);
    } catch (e) {
        console.error('Error parsing photos JSON:', e);
        return [];
    }
}

// ============ CONECTIVIDAD ============

/**
 * Verifica si hay conexión a internet
 * @returns {boolean} True si está online
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Muestra/actualiza indicador de conectividad en header
 * @param {string} selector - Selector CSS del header (default: '.top-bar h3')
 */
export function updateConnectivityIndicator(selector = '.top-bar h3') {
    const header = document.querySelector(selector);
    if (!header) return;
    
    const existingBadge = header.querySelector('.connectivity-badge');
    if (existingBadge) existingBadge.remove();
    
    if (!navigator.onLine) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-warning text-dark ms-2 connectivity-badge';
        badge.textContent = '📵 Offline';
        header.appendChild(badge);
    }
}

// ============ LOCAL STORAGE ============

/**
 * Guarda dato en localStorage con manejo de errores
 * @param {string} key - Clave
 * @param {any} value - Valor (se convertirá a JSON)
 * @returns {boolean} True si se guardó exitosamente
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Error saving to localStorage:', e);
        return false;
    }
}

/**
 * Obtiene dato de localStorage con manejo de errores
 * @param {string} key - Clave
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {any} Valor parseado o defaultValue
 */
export function getFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        return defaultValue;
    }
}

/**
 * Elimina dato de localStorage
 * @param {string} key - Clave a eliminar
 */
export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error('Error removing from localStorage:', e);
    }
}

// ============ ROLES Y BADGES ============

/**
 * Obtiene clase CSS de badge según rol
 * @param {string} role - Rol del usuario
 * @returns {string} Clase CSS
 */
export function getRoleBadgeClass(role) {
    const classes = {
        'ADMIN': 'bg-danger',
        'RECEPTION': 'bg-primary',
        'MAID': 'bg-success'
    };
    return classes[role] || 'bg-secondary';
}

/**
 * Obtiene texto legible del rol
 * @param {string} role - Rol del usuario
 * @returns {string} Texto en español
 */
export function getRoleText(role) {
    const roles = {
        'ADMIN': 'Administrador',
        'RECEPTION': 'Recepción',
        'MAID': 'Mucama'
    };
    return roles[role] || role;
}

/**
 * Obtiene clase CSS de badge según estado de habitación
 * @param {string} status - Estado de la habitación
 * @returns {string} Clase CSS
 */
export function getRoomStatusBadgeClass(status) {
    const classes = {
        'CLEAN': 'bg-success',
        'DIRTY': 'bg-warning text-dark',
        'OCCUPIED': 'bg-danger',
        'MAINTENANCE': 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
}

/**
 * Obtiene texto legible del estado de habitación
 * @param {string} status - Estado
 * @returns {string} Texto en español
 */
export function getRoomStatusText(status) {
    const statuses = {
        'CLEAN': 'Limpia',
        'DIRTY': 'Sucia',
        'OCCUPIED': 'Ocupada',
        'MAINTENANCE': 'Mantenimiento'
    };
    return statuses[status] || status;
}

// ============ DEBOUNCE Y THROTTLE ============

/**
 * Debounce: Ejecuta función después de que dejen de llamarla por X ms
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función debounced
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle: Ejecuta función máximo una vez cada X ms
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function} Función throttled
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============ COPIAR AL PORTAPAPELES ============

/**
 * Copia texto al portapapeles
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} True si se copió exitosamente
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToastWithIcon('Copiado al portapapeles', 'success', 2000);
        return true;
    } catch (e) {
        console.error('Error copying to clipboard:', e);
        showToastWithIcon('Error al copiar', 'error', 2000);
        return false;
    }
}

// ============ CONFIRMACIONES ============

/**
 * Muestra confirmación con Bootstrap modal
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje
 * @param {string} confirmText - Texto del botón confirmar
 * @returns {Promise<boolean>} True si confirmó
 */
export function confirmDialog(title, message, confirmText = 'Confirmar') {
    return new Promise((resolve) => {
        // Usar confirm nativo por ahora (puede mejorarse con modal)
        const result = confirm(`${title}\n\n${message}`);
        resolve(result);
    });
}

// Exportar todas las funciones
export default {
    showToast,
    showToastWithIcon,
    formatDate,
    formatDateShort,
    getRelativeTime,
    truncateText,
    isValidEmail,
    isValidUsername,
    sanitizeString,
    compressImageToBase64,
    parsePhotosJson,
    isOnline,
    updateConnectivityIndicator,
    saveToStorage,
    getFromStorage,
    removeFromStorage,
    getRoleBadgeClass,
    getRoleText,
    getRoomStatusBadgeClass,
    getRoomStatusText,
    debounce,
    throttle,
    copyToClipboard,
    confirmDialog
};
