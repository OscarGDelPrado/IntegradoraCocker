package utex.edu.mx.server.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "incidents")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Incident {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    @JsonIgnoreProperties({"building", "assignedTo"})
    private Room room;
    
    @ManyToOne
    @JoinColumn(name = "reported_by", nullable = false)
    @JsonIgnoreProperties({"password", "hotel"})
    private User reportedBy;
    
    @Column(nullable = false, length = 2000)
    private String description;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IncidentStatus status = IncidentStatus.OPEN;
    
    @Column(name = "photos", columnDefinition = "TEXT")
    private String photos; // JSON array of base64 images
    
    @Column(name = "resolution_notes", length = 2000)
    private String resolutionNotes;
    
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    public enum IncidentStatus {
        OPEN, RESOLVED
    }
}
