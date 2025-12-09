package utex.edu.mx.server.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import utex.edu.mx.server.dto.WebSocketNotification;
import utex.edu.mx.server.model.Room;
import utex.edu.mx.server.repository.RoomRepository;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomSchedulerService {

    private final RoomRepository roomRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Reinicia el estado de las habitaciones cada día a las 8:00 AM
     * - Las habitaciones CLEAN pasan a DIRTY
     * - Se mantienen las asignaciones de mucamas
     * - Las habitaciones OCCUPIED no se modifican
     */
    @Scheduled(cron = "0 0 8 * * *") // Ejecutar a las 8:00 AM todos los días
    @Transactional
    public void dailyRoomReset() {
        log.info("🕐 Iniciando reinicio diario de habitaciones a las 8:00 AM");
        
        try {
            // Obtener todas las habitaciones que están limpias
            List<Room> cleanRooms = roomRepository.findByStatus(Room.RoomStatus.CLEAN);
            
            int updatedCount = 0;
            
            for (Room room : cleanRooms) {
                // Cambiar estado a DIRTY
                room.setStatus(Room.RoomStatus.DIRTY);
                room.setUpdatedAt(LocalDateTime.now());
                
                // Mantener la asignación de mucama (assignedTo no se modifica)
                // La mucama ya asignada seguirá viendo esta habitación
                
                roomRepository.save(room);
                updatedCount++;
                
                log.debug("Habitación {} marcada como DIRTY, asignada a: {}", 
                    room.getNumber(), 
                    room.getAssignedTo() != null ? room.getAssignedTo().getUsername() : "sin asignar");
            }
            
            log.info("✅ Reinicio diario completado: {} habitaciones marcadas como DIRTY", updatedCount);
            
            // Notificar a todos los clientes conectados vía WebSocket
            if (updatedCount > 0) {
                WebSocketNotification notification = new WebSocketNotification(
                    "DAILY_RESET",
                    String.format("Reinicio diario: %d habitaciones marcadas como pendientes de limpieza", updatedCount),
                    null
                );
                messagingTemplate.convertAndSend("/topic/rooms", notification);
                messagingTemplate.convertAndSend("/topic/notifications", notification);
            }
            
        } catch (Exception e) {
            log.error("❌ Error durante el reinicio diario de habitaciones", e);
        }
    }
    
    /**
     * Método para ejecutar el reinicio manualmente (útil para pruebas)
     */
    @Transactional
    public int manualReset() {
        log.info("🔧 Reinicio manual de habitaciones solicitado");
        
        List<Room> cleanRooms = roomRepository.findByStatus(Room.RoomStatus.CLEAN);
        
        for (Room room : cleanRooms) {
            room.setStatus(Room.RoomStatus.DIRTY);
            room.setUpdatedAt(LocalDateTime.now());
            roomRepository.save(room);
        }
        
        int count = cleanRooms.size();
        log.info("✅ Reinicio manual completado: {} habitaciones actualizadas", count);
        
        // Notificar
        if (count > 0) {
            WebSocketNotification notification = new WebSocketNotification(
                "MANUAL_RESET",
                String.format("Reinicio manual: %d habitaciones marcadas como pendientes", count),
                null
            );
            messagingTemplate.convertAndSend("/topic/rooms", notification);
            messagingTemplate.convertAndSend("/topic/notifications", notification);
        }
        
        return count;
    }
}
