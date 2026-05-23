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
        record.setStatus("PENDING");

        return repository.save(record);
    }

    @Transactional
    public LeaveRecord updateLeaveStatus(String tenantId, Long id, String status) {
        LeaveRecord record = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found"));
        
        String upperStatus = status.toUpperCase();
        if (!upperStatus.equals("PENDING") && !upperStatus.equals("APPROVED") && !upperStatus.equals("REJECTED")) {
            throw new IllegalArgumentException("Invalid status. Must be PENDING, APPROVED, or REJECTED");
        }
        
        record.setStatus(upperStatus);
        return repository.save(record);
    }
}
