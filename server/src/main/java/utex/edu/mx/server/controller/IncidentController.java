package utex.edu.mx.server.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import utex.edu.mx.server.dto.WebSocketNotification;
import utex.edu.mx.server.model.Incident;
import utex.edu.mx.server.model.Room;
import utex.edu.mx.server.model.User;
import utex.edu.mx.server.repository.IncidentRepository;
import utex.edu.mx.server.repository.RoomRepository;
import utex.edu.mx.server.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/incidents")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class IncidentController {
    
    private final IncidentRepository incidentRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    
    @GetMapping
    public ResponseEntity<List<Incident>> getAllIncidents() {
        return ResponseEntity.ok(incidentRepository.findAll());
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<Incident> getIncidentById(@PathVariable Long id) {
        return incidentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<Incident>> getIncidentsByRoom(@PathVariable Long roomId) {
        return ResponseEntity.ok(incidentRepository.findByRoomId(roomId));
    }
    
    @GetMapping("/maid/{maidId}")
    public ResponseEntity<List<Incident>> getIncidentsByMaid(@PathVariable Long maidId) {
        return ResponseEntity.ok(incidentRepository.findByReportedById(maidId));
    }
    
    @GetMapping("/status/{status}")
    public ResponseEntity<List<Incident>> getIncidentsByStatus(@PathVariable Incident.IncidentStatus status) {
        return ResponseEntity.ok(incidentRepository.findByStatus(status));
    }
    
    @PostMapping
    public ResponseEntity<Incident> createIncident(@RequestBody Incident incident) {
        // Fetch and set the Room entity
        if (incident.getRoom() != null && incident.getRoom().getId() != null) {
            Room room = roomRepository.findById(incident.getRoom().getId())
                .orElseThrow(() -> new RuntimeException("Room not found with id: " + incident.getRoom().getId()));
            incident.setRoom(room);
        }
        
        // Fetch and set the User entity
        if (incident.getReportedBy() != null && incident.getReportedBy().getId() != null) {
            User user = userRepository.findById(incident.getReportedBy().getId())
                .orElseThrow(() -> new RuntimeException("User not found with id: " + incident.getReportedBy().getId()));
            incident.setReportedBy(user);
        }
        
        incident.setCreatedAt(LocalDateTime.now());
        incident.setUpdatedAt(LocalDateTime.now());
        Incident savedIncident = incidentRepository.save(incident);
        
        // Broadcast WebSocket notification
        WebSocketNotification notification = new WebSocketNotification(
            "INCIDENT_CREATED",
            "Nueva incidencia reportada en Hab. " + (savedIncident.getRoom() != null ? savedIncident.getRoom().getNumber() : "N/A"),
            savedIncident
        );
        messagingTemplate.convertAndSend("/topic/incidents", notification);
        messagingTemplate.convertAndSend("/topic/notifications", notification);
        
        return ResponseEntity.ok(savedIncident);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<Incident> updateIncident(@PathVariable Long id, @RequestBody Incident incidentDetails) {
        return incidentRepository.findById(id)
                .map(incident -> {
                    incident.setDescription(incidentDetails.getDescription());
                    incident.setStatus(incidentDetails.getStatus());
                    incident.setResolutionNotes(incidentDetails.getResolutionNotes());
                    incident.setResolvedAt(incidentDetails.getResolvedAt());
                    incident.setUpdatedAt(LocalDateTime.now());
                    Incident updatedIncident = incidentRepository.save(incident);
                    
                    // Broadcast WebSocket notification
                    WebSocketNotification notification = new WebSocketNotification(
                        "INCIDENT_UPDATED",
                        "Incidencia actualizada",
                        updatedIncident
                    );
                    messagingTemplate.convertAndSend("/topic/incidents", notification);
                    
                    return ResponseEntity.ok(updatedIncident);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PatchMapping("/{id}/resolve")
    public ResponseEntity<Incident> resolveIncident(@PathVariable Long id, @RequestBody String resolutionNotes) {
        return incidentRepository.findById(id)
                .map(incident -> {
                    incident.setStatus(Incident.IncidentStatus.RESOLVED);
                    incident.setResolutionNotes(resolutionNotes);
                    incident.setResolvedAt(LocalDateTime.now());
                    incident.setUpdatedAt(LocalDateTime.now());
                    Incident resolvedIncident = incidentRepository.save(incident);
                    
                    // Broadcast WebSocket notification
                    WebSocketNotification notification = new WebSocketNotification(
                        "INCIDENT_RESOLVED",
                        "Incidencia resuelta en Hab. " + (resolvedIncident.getRoom() != null ? resolvedIncident.getRoom().getNumber() : "N/A"),
                        resolvedIncident
                    );
                    messagingTemplate.convertAndSend("/topic/incidents", notification);
                    messagingTemplate.convertAndSend("/topic/notifications", notification);
                    
                    return ResponseEntity.ok(resolvedIncident);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIncident(@PathVariable Long id) {
        return incidentRepository.findById(id)
                .map(incident -> {
                    incidentRepository.delete(incident);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
