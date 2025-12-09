package utex.edu.mx.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utex.edu.mx.server.model.Incident;
import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByRoomId(Long roomId);
    List<Incident> findByReportedById(Long userId);
    List<Incident> findByStatus(Incident.IncidentStatus status);
}
