package utex.edu.mx.server.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import utex.edu.mx.server.model.Hotel;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, Long> {
}
