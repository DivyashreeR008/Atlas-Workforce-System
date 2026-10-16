package com.atlas.leave;

import com.atlas.common.security.RequiresRole;
import com.atlas.common.security.TenantId;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/leave")
@CrossOrigin(origins = "${ALLOWED_ORIGINS:http://localhost:3000}")
public class LeaveController {

    private final LeaveService service;

    public LeaveController(LeaveService service) {
        this.service = service;
    }

    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping
    public ResponseEntity<Page<LeaveRecord>> getAllLeaveRequests(
            @TenantId String tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        return ResponseEntity.ok(service.getAllLeaveRequests(tenantId, pageable));
    }

    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<Page<LeaveRecord>> getLeaveByEmployee(
            @TenantId String tenantId,
            @PathVariable String employeeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        return ResponseEntity.ok(service.getLeaveByEmployeeId(tenantId, employeeId, pageable));
    }

    @RequiresRole({"admin", "hr", "manager", "employee"})
    @PostMapping("/request")
    public ResponseEntity<?> requestLeave(
            @RequestBody Map<String, String> request,
            @TenantId String tenantId) {
        String employeeId = request.get("employeeId");
        String startStr = request.get("startDate");
        String endStr = request.get("endDate");
        if (employeeId == null || employeeId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "employeeId is required"));
        }
        if (startStr == null || startStr.isBlank() || endStr == null || endStr.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "startDate and endDate are required"));
        }
        final LocalDate startDate;
        final LocalDate endDate;
        try {
            startDate = LocalDate.parse(startStr);
            endDate = LocalDate.parse(endStr);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid date format, expected YYYY-MM-DD"));
        }
        try {
            String leaveType = request.get("leaveType");
            String reason = request.get("reason");

            LeaveRecord record = service.requestLeave(tenantId, employeeId, startDate, endDate, leaveType, reason);
            return ResponseEntity.ok(record);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Error submitting leave request"));
        }
    }

    @RequiresRole({"admin", "hr", "manager"})
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateLeaveStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            @TenantId String tenantId) {

        String status = request.get("status");
        if (status == null || status.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "status is required"));
        }
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            String userRole = attrs != null ? (String) attrs.getRequest().getAttribute("x-user-role") : "employee";
            LeaveRecord record = service.updateLeaveStatus(tenantId, id, status, userRole);
            return ResponseEntity.ok(record);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Error updating leave status"));
        }
    }
}
