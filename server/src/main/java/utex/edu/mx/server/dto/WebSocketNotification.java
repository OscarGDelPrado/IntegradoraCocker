package utex.edu.mx.server.dto;

/**
 * DTO para notificaciones WebSocket
 * Enviado a clientes suscritos a /topic/notifications
 */
public class WebSocketNotification {
    private String type; // INCIDENT_CREATED, ROOM_UPDATED, USER_ASSIGNED, etc.
    private String message;
    private Object data;
    private Long timestamp;

    public WebSocketNotification() {
        this.timestamp = System.currentTimeMillis();
    }

    public WebSocketNotification(String type, String message, Object data) {
        this.type = type;
        this.message = message;
        this.data = data;
        this.timestamp = System.currentTimeMillis();
    }

    // Getters y Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }
}
