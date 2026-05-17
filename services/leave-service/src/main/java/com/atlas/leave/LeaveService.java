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

    public List<LeaveRecord> getAllLeaveRequests() {
        return repository.findAll();
    }

    public List<LeaveRecord> getLeaveByEmployeeId(String employeeId) {
        return repository.findByEmployeeId(employeeId);
    }

    @Transactional
    public LeaveRecord requestLeave(String employeeId, LocalDate startDate, LocalDate endDate, String leaveType, String reason) {
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date must be before or equal to end date");
        }

        LeaveRecord record = new LeaveRecord();
        record.setEmployeeId(employeeId);
        record.setStartDate(startDate);
        record.setEndDate(endDate);
        record.setLeaveType(leaveType);
        record.setReason(reason);
        record.setStatus("PENDING");

        return repository.save(record);
    }

    @Transactional
    public LeaveRecord updateLeaveStatus(Long id, String status) {
        LeaveRecord record = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Leave request not found"));
        
        record.setStatus(status.toUpperCase());
        return repository.save(record);
    }
}
