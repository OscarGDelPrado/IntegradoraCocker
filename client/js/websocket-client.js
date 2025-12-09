/* ======================================
   WEBSOCKET-CLIENT.JS - Cliente WebSocket con STOMP
   Conecta con ws://localhost:8080/ws
   Tópicos: /topic/incidents, /topic/rooms, /topic/notifications
   ====================================== */

import { API_URL } from './config.js';

class WebSocketClient {
    constructor() {
        this.stompClient = null;
        this.connected = false;
        this.subscriptions = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    // Conectar al WebSocket
    connect(onConnected) {
        if (this.connected) {
            console.log('WebSocket already connected');
            return;
        }

        try {
            // SockJS maneja la conexión HTTP, no necesitamos convertir a ws://
            const wsUrl = API_URL + '/ws';
            const socket = new SockJS(wsUrl);
            this.stompClient = Stomp.over(socket);

            // Deshabilitar logs de debug en producción
            this.stompClient.debug = (msg) => {
                if (import.meta.env?.DEV) console.log(msg);
            };

            this.stompClient.connect(
                {},
                (frame) => {
                    console.log('✅ WebSocket connected:', frame);
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    
                    if (onConnected) onConnected();
                },
                (error) => {
                    console.warn('⚠️ WebSocket connection error (backend may be offline):', error);
                    this.connected = false;
                    // No intentar reconectar si el backend no está disponible
                    // this.attemptReconnect();
                }
            );
        } catch (error) {
            console.warn('⚠️ Error initializing WebSocket:', error);
            this.connected = false;
        }
    }

    // Intentar reconexión automática
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }

    // Suscribirse a un tópico
    subscribe(topic, callback) {
        if (!this.connected || !this.stompClient) {
            console.warn('Cannot subscribe: WebSocket not connected');
            return null;
        }

        const subscription = this.stompClient.subscribe(topic, (message) => {
            try {
                const data = JSON.parse(message.body);
                callback(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        this.subscriptions.push({ topic, subscription });
        console.log(`📡 Subscribed to ${topic}`);
        
        return subscription;
    }

    // Desuscribirse de un tópico
    unsubscribe(subscription) {
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions = this.subscriptions.filter(s => s.subscription !== subscription);
        }
    }

    // Enviar mensaje (si se necesita)
    send(destination, body) {
        if (!this.connected || !this.stompClient) {
            console.warn('Cannot send: WebSocket not connected');
            return;
        }

        this.stompClient.send(destination, {}, JSON.stringify(body));
    }

    // Desconectar
    disconnect() {
        if (this.stompClient) {
            // Desuscribirse de todos los tópicos
            this.subscriptions.forEach(({ subscription }) => {
                subscription.unsubscribe();
            });
            this.subscriptions = [];

            this.stompClient.disconnect(() => {
                console.log('WebSocket disconnected');
                this.connected = false;
            });
        }
    }

    // Verificar estado de conexión
    isConnected() {
        return this.connected;
    }
}

// Singleton instance
const wsClient = new WebSocketClient();

export default wsClient;
