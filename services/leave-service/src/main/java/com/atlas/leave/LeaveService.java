package com.atlas.leave;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class LeaveService {

    private final LeaveRepository repository;
    private final RabbitTemplate rabbitTemplate;

    public LeaveService(LeaveRepository repository, RabbitTemplate rabbitTemplate) {
        this.repository = repository;
        this.rabbitTemplate = rabbitTemplate;
    }

    public Page<LeaveRecord> getAllLeaveRequests(String tenantId, Pageable pageable) {
        return repository.findByTenantId(tenantId, pageable);
    }

    public Page<LeaveRecord> getLeaveByEmployeeId(String tenantId, String employeeId, Pageable pageable) {
        return repository.findByTenantIdAndEmployeeId(tenantId, employeeId, pageable);
    }

    @Transactional
    public LeaveRecord requestLeave(String tenantId, String employeeId, LocalDate startDate, LocalDate endDate, String leaveType, String reason) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("tenantId is required");
        }
        if (employeeId == null || employeeId.isBlank()) {
            throw new IllegalArgumentException("employeeId is required");
        }
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("startDate and endDate are required");
        }
        if (leaveType == null || leaveType.isBlank()) {
            throw new IllegalArgumentException("leaveType is required");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("reason is required");
        }
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date must be before or equal to end date");
        }

        List<LeaveRecord> overlapping = repository.findOverlapping(tenantId, employeeId, startDate, endDate, null);
        if (!overlapping.isEmpty()) {
            throw new IllegalArgumentException("Leave request overlaps with an existing leave request");
        }

        LeaveRecord record = new LeaveRecord();
        record.setTenantId(tenantId);
        record.setEmployeeId(employeeId);
        record.setStartDate(startDate);
        record.setEndDate(endDate);
        record.setLeaveType(leaveType);
        record.setReason(reason);
        record.setStatus(LeaveStatus.PENDING);

        return repository.save(record);
    }

    @Transactional
    public LeaveRecord updateLeaveStatus(String tenantId, Long id, String status, String userRole) {
        LeaveRecord record = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found"));

        LeaveStatus currentStatus = record.getStatus();
        LeaveStatus newStatus;

        // Parse the desired status string into an enum value
        try {
            newStatus = LeaveStatus.valueOf(status.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                "Invalid status value: '" + status + "'. Must be one of: PENDING, APPROVED, REJECTED, CANCELLED");
        }

        // No-op: same status — nothing to validate or persist
        if (currentStatus == newStatus) {
            return record;
        }

        // Delegate transition validation to the enum
        if (!LeaveStatus.isValidTransition(currentStatus, newStatus, userRole, record.getStartDate())) {
            throw new IllegalArgumentException(buildErrorMessage(currentStatus, newStatus, userRole, record.getStartDate()));
        }

        // LEV-003: Check leave balance before approving
        if (newStatus == LeaveStatus.APPROVED) {
            int requestedDays = calculateLeaveDays(record.getStartDate(), record.getEndDate());
            int usedDays = calculateUsedLeaveDays(tenantId, record.getEmployeeId(), id);
            int balance = getEmployeeLeaveBalance(record.getEmployeeId(), record.getLeaveType());
            if (usedDays + requestedDays > balance) {
                throw new IllegalArgumentException(
                    "Insufficient leave balance. Requested: " + requestedDays
                    + " days, Already used/pending: " + usedDays
                    + " days, Available: " + balance + " days");
            }
        }

        record.setStatus(newStatus);
        LeaveRecord saved = repository.save(record);

        // Broker publishes must not roll back the committed DB update, so each
        // send is guarded. A durable outbox table drained after commit would be
        // the fuller fix; guarded sends keep parity with the notification path.
        String routingKey = "leave." + newStatus.name().toLowerCase();
        Map<String, Object> event = new HashMap<>();
        event.put("event", routingKey);
        event.put("leave_id", saved.getId());
        event.put("employee_id", saved.getEmployeeId());
        event.put("tenant_id", tenantId);
        event.put("status", newStatus.name());
        event.put("leave_type", saved.getLeaveType());
        event.put("start_date", saved.getStartDate().toString());
        event.put("end_date", saved.getEndDate().toString());
        event.put("timestamp", Instant.now().toString());
        try {
            rabbitTemplate.convertAndSend("live_exchange", routingKey, event);
        } catch (Exception e) {
            System.err.println("Failed to publish leave event " + routingKey + ": " + e.getMessage());
        }

        if (newStatus == LeaveStatus.APPROVED || newStatus == LeaveStatus.REJECTED
                || newStatus == LeaveStatus.CANCELLED) {
            String eventName = "leave." + newStatus.name().toLowerCase();
            String title;
            String message;
            if (newStatus == LeaveStatus.APPROVED) {
                title = "Leave Approved";
                message = "Your " + saved.getLeaveType() + " leave from "
                        + saved.getStartDate() + " to " + saved.getEndDate() + " has been approved.";
            } else if (newStatus == LeaveStatus.REJECTED) {
                title = "Leave Rejected";
                message = "Your " + saved.getLeaveType() + " leave from "
                        + saved.getStartDate() + " to " + saved.getEndDate() + " has been rejected.";
            } else {
                title = "Leave Cancelled";
                message = "Your " + saved.getLeaveType() + " leave from "
                        + saved.getStartDate() + " to " + saved.getEndDate() + " has been cancelled.";
            }
            Map<String, Object> notification = new HashMap<>();
            notification.put("event", eventName);
            notification.put("tenant_id", saved.getTenantId());
            notification.put("employeeId", saved.getEmployeeId());
            notification.put("leaveId", saved.getId());
            notification.put("title", title);
            notification.put("message", message);
            try {
                rabbitTemplate.convertAndSend("notifications_exchange", "", notification);
            } catch (Exception e) {
                System.err.println("Failed to publish leave notification " + eventName + ": " + e.getMessage());
            }
        }

        return saved;
    }

    private int calculateLeaveDays(LocalDate start, LocalDate end) {
        return (int) ChronoUnit.DAYS.between(start, end) + 1;
    }

    private int calculateUsedLeaveDays(String tenantId, String employeeId, Long excludedId) {
        List<LeaveRecord> records = repository.findByTenantIdAndEmployeeIdAndStatusIn(
                tenantId, employeeId, List.of(LeaveStatus.APPROVED, LeaveStatus.PENDING));
        return records.stream()
                .filter(r -> !r.getId().equals(excludedId))
                .mapToInt(r -> calculateLeaveDays(r.getStartDate(), r.getEndDate()))
                .sum();
    }

    private int getEmployeeLeaveBalance(String employeeId, String leaveType) {
        // Base annual entitlement by leave policy. Production would resolve this
        // from an HR policy service with tenure accrual (e.g. extra days after
        // N years of service); the switch below is the local policy fallback.
        if (leaveType == null) {
            return 20;
        }
        switch (leaveType.trim().toUpperCase()) {
            case "SICK":
                return 10;
            case "PERSONAL":
                return 5;
            case "VACATION":
            case "ANNUAL":
                return 20;
            default:
                return 20;
        }
    }

    /**
     * Builds a descriptive error message explaining why a transition is not allowed.
     */
    private static String buildErrorMessage(LeaveStatus current, LeaveStatus next, String userRole, LocalDate startDate) {
        String role = (userRole != null) ? userRole.toLowerCase() : "";

        // Terminal states
        if (current == LeaveStatus.REJECTED) {
            return "Cannot transition from REJECTED to " + next
                   + ". A rejected leave request cannot be modified.";
        }
        if (current == LeaveStatus.CANCELLED) {
            return "Cannot transition from CANCELLED to " + next
                   + ". A cancelled leave request cannot be modified.";
        }

        // APPROVED — can only be cancelled by the employee before the start date
        if (current == LeaveStatus.APPROVED) {
            if (next != LeaveStatus.CANCELLED) {
                return "Cannot transition from APPROVED to " + next
                       + ". An approved leave can only be cancelled.";
            }
            if (!"employee".equals(role)) {
                return "Only the employee who submitted the leave can cancel an approved request.";
            }
            if (startDate != null && !startDate.isAfter(LocalDate.now())) {
                return "Cancellation is only allowed before the leave start date (" + startDate + ").";
            }
        }

        // PENDING
        if (current == LeaveStatus.PENDING) {
            if ((next == LeaveStatus.APPROVED || next == LeaveStatus.REJECTED)
                    && !("admin".equals(role) || "manager".equals(role))) {
                return "Only managers or administrators can approve or reject a pending leave request.";
            }
            if (next == LeaveStatus.CANCELLED && !"employee".equals(role)) {
                return "Only the employee who submitted the leave can cancel a pending request.";
            }
        }

        // Fallback (should not be reached if isValidTransition is kept in sync)
        return "Invalid status transition from " + current + " to " + next
               + " for user role '" + userRole + "'.";
    }
}
