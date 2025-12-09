package utex.edu.mx.server.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configuración WebSocket con STOMP para notificaciones en tiempo real
 * Endpoint: ws://localhost:8080/ws
 * Tópicos:
 *   - /topic/incidents - Nuevas incidencias
 *   - /topic/rooms - Actualizaciones de habitaciones
 *   - /topic/notifications - Notificaciones generales
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Habilitar un message broker simple en memoria
        config.enableSimpleBroker("/topic");
        
        // Prefijo para mensajes destinados a métodos @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint WebSocket con SockJS fallback
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // En producción, especificar dominios exactos
                .withSockJS();
    }
}
