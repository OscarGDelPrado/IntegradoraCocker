package utex.edu.mx.server.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import utex.edu.mx.server.model.User;
import utex.edu.mx.server.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173", "http://localhost:5500", "http://127.0.0.1:5500"})
public class UserController {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    /**
     * GET /api/users
     * Obtener todos los usuarios
     */
    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
    
    /**
     * GET /api/users/{id}
     * Obtener usuario por ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * GET /api/users/role/{role}
     * Obtener usuarios por rol (ADMIN, RECEPTION, MAID)
     */
    @GetMapping("/role/{role}")
    public List<User> getUsersByRole(@PathVariable String role) {
        try {
            User.Role roleEnum = User.Role.valueOf(role.toUpperCase());
            return userRepository.findByRole(roleEnum);
        } catch (IllegalArgumentException e) {
            return List.of();
        }
    }
    
    /**
     * GET /api/users/hotel/{hotelId}
     * Obtener usuarios por hotel
     */
    @GetMapping("/hotel/{hotelId}")
    public List<User> getUsersByHotel(@PathVariable Long hotelId) {
        return userRepository.findByHotelId(hotelId);
    }
    
    /**
     * GET /api/users/active
     * Obtener solo usuarios activos
     */
    @GetMapping("/active")
    public List<User> getActiveUsers() {
        return userRepository.findByActive(true);
    }
    
    /**
     * POST /api/users
     * Crear nuevo usuario
     */
    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody User user) {
        // Validaciones
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Username es requerido");
        }
        
        if (user.getName() == null || user.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Nombre es requerido");
        }
        
        if (user.getRole() == null) {
            return ResponseEntity.badRequest().body("Rol es requerido");
        }
        
        // Verificar que el username no exista
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("Username ya existe");
        }
        
        // Encriptar password
        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Password es requerido");
        }
        
        if (user.getPassword().length() < 4) {
            return ResponseEntity.badRequest().body("Password debe tener al menos 4 caracteres");
        }
        
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        
        // Setear valores por defecto
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        
        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(savedUser);
    }
    
    /**
     * PUT /api/users/{id}
     * Actualizar usuario existente
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        return userRepository.findById(id)
                .map(user -> {
                    // Validar campos requeridos
                    if (userDetails.getName() != null && userDetails.getName().trim().isEmpty()) {
                        return ResponseEntity.badRequest().body("Nombre no puede estar vacío");
                    }
                    
                    // Actualizar username solo si cambió y no existe
                    if (userDetails.getUsername() != null && !userDetails.getUsername().equals(user.getUsername())) {
                        if (userRepository.findByUsername(userDetails.getUsername()).isPresent()) {
                            return ResponseEntity.badRequest().body("Username ya existe");
                        }
                        user.setUsername(userDetails.getUsername());
                    }
                    
                    // Actualizar campos permitidos
                    if (userDetails.getName() != null) {
                        user.setName(userDetails.getName());
                    }
                    if (userDetails.getEmail() != null) {
                        user.setEmail(userDetails.getEmail());
                    }
                    if (userDetails.getRole() != null) {
                        user.setRole(userDetails.getRole());
                    }
                    if (userDetails.getHotel() != null) {
                        user.setHotel(userDetails.getHotel());
                    }
                    
                    // Solo actualizar password si se proporciona uno nuevo
                    if (userDetails.getPassword() != null && !userDetails.getPassword().trim().isEmpty()) {
                        if (userDetails.getPassword().trim().length() < 4) {
                            return ResponseEntity.badRequest().body("Password debe tener al menos 4 caracteres");
                        }
                        user.setPassword(passwordEncoder.encode(userDetails.getPassword()));
                    }
                    
                    user.setUpdatedAt(LocalDateTime.now());
                    User updatedUser = userRepository.save(user);
                    return ResponseEntity.ok(updatedUser);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * PATCH /api/users/{id}/activate
     * Activar/desactivar usuario
     */
    @PatchMapping("/{id}/activate")
    public ResponseEntity<?> toggleUserStatus(@PathVariable Long id, @RequestBody Boolean active) {
        return userRepository.findById(id)
                .map(user -> {
                    // Prevenir desactivación de administradores
                    if (user.getRole() == User.Role.ADMIN && !active) {
                        return ResponseEntity.badRequest().body("No se puede desactivar un usuario administrador");
                    }
                    
                    user.setActive(active);
                    user.setUpdatedAt(LocalDateTime.now());
                    User updatedUser = userRepository.save(user);
                    return ResponseEntity.ok(updatedUser);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * DELETE /api/users/{id}
     * Eliminar usuario (soft delete - marca como inactivo)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(user -> {
                    // Prevenir eliminación de administradores
                    if (user.getRole() == User.Role.ADMIN) {
                        return ResponseEntity.badRequest().body("No se puede eliminar un usuario administrador");
                    }
                    
                    // Soft delete: marcar como inactivo en lugar de eliminar
                    user.setActive(false);
                    user.setUpdatedAt(LocalDateTime.now());
                    userRepository.save(user);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * DELETE /api/users/{id}/hard
     * Eliminar usuario permanentemente (solo para admin)
     */
    @DeleteMapping("/{id}/hard")
    public ResponseEntity<Void> hardDeleteUser(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(user -> {
                    userRepository.delete(user);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
