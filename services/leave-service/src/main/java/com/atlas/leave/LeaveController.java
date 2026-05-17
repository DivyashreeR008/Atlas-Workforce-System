package com.atlas.leave;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leave")
@CrossOrigin(origins = "*")
public class LeaveController {

    private final LeaveService service;

    public LeaveController(LeaveService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<LeaveRecord>> getAllLeaveRequests() {
        return ResponseEntity.ok(service.getAllLeaveRequests());
    }

    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<List<LeaveRecord>> getLeaveByEmployee(@PathVariable String employeeId) {
        return ResponseEntity.ok(service.getLeaveByEmployeeId(employeeId));
    }

    @PostMapping("/request")
    public ResponseEntity<?> requestLeave(@RequestBody Map<String, String> request) {
        try {
            String employeeId = request.get("employeeId");
            LocalDate startDate = LocalDate.parse(request.get("startDate"));
            LocalDate endDate = LocalDate.parse(request.get("endDate"));
            String leaveType = request.get("leaveType");
            String reason = request.get("reason");

            LeaveRecord record = service.requestLeave(employeeId, startDate, endDate, leaveType, reason);
            return ResponseEntity.ok(record);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Error submitting leave request"));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateLeaveStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        
        if (userRole == null || !userRole.equalsIgnoreCase("admin")) {
            return ResponseEntity.status(403).body(Map.of("message", "Access denied: Requires administrator privileges"));
        }

        try {
            String status = request.get("status");
            LeaveRecord record = service.updateLeaveStatus(id, status);
            return ResponseEntity.ok(record);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Error updating leave status"));
        }
    }
}
