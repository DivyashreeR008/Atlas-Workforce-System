package com.ems.payroll;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PayrollService {

    private final PayrollRepository repository;

    public PayrollService(PayrollRepository repository) {
        this.repository = repository;
    }

    public List<PayrollRecord> getAllPayrolls() {
        return repository.findAll();
    }

    public List<PayrollRecord> getPayrollsByEmployeeId(String employeeId) {
        return repository.findByEmployeeId(employeeId);
    }

    @Transactional
    public PayrollRecord runPayroll(String employeeId, String period, Double baseSalary, Double allowances, Double deductions) {
        // Check if payroll already exists for this period
        List<PayrollRecord> existing = repository.findByEmployeeIdAndPeriod(employeeId, period);
        if (!existing.isEmpty()) {
            throw new IllegalArgumentException("Payroll already processed for this period");
        }

        double grossSalary = baseSalary + allowances - deductions;
        double tax = calculateTax(grossSalary);
        double netSalary = grossSalary - tax;

        PayrollRecord record = new PayrollRecord();
        record.setEmployeeId(employeeId);
        record.setPeriod(period);
        record.setBaseSalary(baseSalary);
        record.setAllowances(allowances);
        record.setDeductions(deductions);
        record.setTax(tax);
        record.setNetSalary(netSalary);
        record.setStatus("PROCESSED");
        record.setProcessedDate(LocalDateTime.now());

        return repository.save(record);
    }

    private double calculateTax(double grossSalary) {
        // Simple progressive tax calculation
        if (grossSalary <= 3000) return 0;
        if (grossSalary <= 7000) return (grossSalary - 3000) * 0.15;
        if (grossSalary <= 12000) return (4000 * 0.15) + ((grossSalary - 7000) * 0.25);
        return (4000 * 0.15) + (5000 * 0.25) + ((grossSalary - 12000) * 0.35);
    }
}
