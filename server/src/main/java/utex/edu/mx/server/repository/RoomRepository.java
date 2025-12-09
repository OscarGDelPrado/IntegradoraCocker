package utex.edu.mx.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utex.edu.mx.server.model.Room;
import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByBuildingId(Long buildingId);
    List<Room> findByStatus(Room.RoomStatus status);
    List<Room> findByAssignedToId(Long maidId);
}
