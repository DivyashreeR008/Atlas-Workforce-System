package com.atlas.leave;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class LeaveService {

    private final LeaveRepository repository;

    public LeaveService(LeaveRepository repository) {
        this.repository = repository;
    }

    public List<LeaveRecord> getAllLeaveRequests(String tenantId) {
        return repository.findByTenantId(tenantId);
    }

    public List<LeaveRecord> getLeaveByEmployeeId(String tenantId, String employeeId) {
        return repository.findByTenantIdAndEmployeeId(tenantId, employeeId);
    }

    @Transactional
    public LeaveRecord requestLeave(String tenantId, String employeeId, LocalDate startDate, LocalDate endDate, String leaveType, String reason) {
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date must be before or equal to end date");
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

        record.setStatus(newStatus);
        return repository.save(record);
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
