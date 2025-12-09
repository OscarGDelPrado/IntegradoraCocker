package utex.edu.mx.server.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Room {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String number;
    
    @Column(nullable = false)
    private Integer floor;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomStatus status = RoomStatus.DIRTY;
    
    @ManyToOne
    @JoinColumn(name = "building_id", nullable = false)
    @JsonIgnoreProperties({"rooms", "hotel"})
    private Building building;
    
    @ManyToOne
    @JoinColumn(name = "assigned_to")
    @JsonIgnoreProperties({"password", "rooms"})
    private User assignedTo;
    
    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;
    
    @Column(name = "active")
    private Boolean active = true;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    public enum RoomStatus {
        CLEAN, DIRTY, OCCUPIED
    }
}
