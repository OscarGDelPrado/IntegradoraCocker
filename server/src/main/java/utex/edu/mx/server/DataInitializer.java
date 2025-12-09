package utex.edu.mx.server;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import utex.edu.mx.server.model.*;
import utex.edu.mx.server.repository.*;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    
    private final UserRepository userRepository;
    private final HotelRepository hotelRepository;
    private final BuildingRepository buildingRepository;
    private final RoomRepository roomRepository;
    private final PasswordEncoder passwordEncoder;
    
    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            initializeData();
        }
    }
    
    private void initializeData() {
        // Create Hotel
        Hotel hotel = new Hotel();
        hotel.setName("Hotel Example");
        hotel.setAddress("123 Main St");
        hotel.setPhone("555-0100");
        hotel.setEmail("info@hotelexample.com");
        hotel.setActive(true);
        hotel = hotelRepository.save(hotel);
        
        // Create Building
        Building building = new Building();
        building.setName("Edificio Principal");
        building.setFloors(5);
        building.setHotel(hotel);
        building.setActive(true);
        building = buildingRepository.save(building);
        
        // Create Rooms
        for (int floor = 1; floor <= 3; floor++) {
            for (int num = 1; num <= 5; num++) {
                Room room = new Room();
                room.setNumber(String.format("%d0%d", floor, num));
                room.setFloor(floor);
                room.setStatus(Room.RoomStatus.DIRTY);
                room.setBuilding(building);
                room.setActive(true);
                roomRepository.save(room);
            }
        }
        
        // Create Users
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword(passwordEncoder.encode("password"));
        admin.setName("Administrador");
        admin.setEmail("admin@hotel.com");
        admin.setRole(User.Role.ADMIN);
        admin.setHotel(hotel);
        admin.setActive(true);
        userRepository.save(admin);
        
        User maid1 = new User();
        maid1.setUsername("mucama1");
        maid1.setPassword(passwordEncoder.encode("password"));
        maid1.setName("Ana García");
        maid1.setEmail("ana@hotel.com");
        maid1.setRole(User.Role.MAID);
        maid1.setHotel(hotel);
        maid1.setActive(true);
        userRepository.save(maid1);
        
        System.out.println("✅ Initial data loaded successfully!");
        System.out.println("👤 Admin user: admin / password");
        System.out.println("👤 Maid user: mucama1 / password");
    }
}
