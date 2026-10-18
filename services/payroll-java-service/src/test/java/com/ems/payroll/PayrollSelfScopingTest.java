package com.ems.payroll;

import com.ems.payroll.model.Payslip;
import com.ems.payroll.repository.BankTransactionRepository;
import com.ems.payroll.repository.BenefitEnrollmentRepository;
import com.ems.payroll.repository.BenefitPlanRepository;
import com.ems.payroll.repository.BonusRepository;
import com.ems.payroll.repository.CompensationPlanRepository;
import com.ems.payroll.repository.CountryTaxConfigRepository;
import com.ems.payroll.repository.EnhancedPayrollRepository;
import com.ems.payroll.repository.EquityGrantRepository;
import com.ems.payroll.repository.ExpenseReportRepository;
import com.ems.payroll.repository.OutboxEventRepository;
import com.ems.payroll.repository.PayrollAnomalyRepository;
import com.ems.payroll.repository.PayrollAuditRepository;
import com.ems.payroll.repository.PayrollComplianceReportRepository;
import com.ems.payroll.repository.PayrollForecastRepository;
import com.ems.payroll.repository.PayslipRepository;
import com.ems.payroll.repository.SalaryBenchmarkRepository;
import com.ems.payroll.repository.TaxBracketRepository;
import com.ems.payroll.service.PayrollEnterpriseService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Scoping tests for the self-service payslip lookup. The employee identity in
 * production comes from the verified internal token; these tests pin the
 * service contract that a payslip id can only ever resolve inside the caller's
 * own employee id and tenant.
 */
@ExtendWith(MockitoExtension.class)
class PayrollSelfScopingTest {

    @Mock private EnhancedPayrollRepository payrollRepo;
    @Mock private CountryTaxConfigRepository taxConfigRepo;
    @Mock private TaxBracketRepository taxBracketRepo;
    @Mock private PayrollAuditRepository auditRepo;
    @Mock private ExpenseReportRepository expenseRepo;
    @Mock private BenefitPlanRepository benefitPlanRepo;
    @Mock private BenefitEnrollmentRepository benefitEnrollRepo;
    @Mock private BonusRepository bonusRepo;
    @Mock private EquityGrantRepository equityRepo;
    @Mock private CompensationPlanRepository compensationRepo;
    @Mock private SalaryBenchmarkRepository benchmarkRepo;
    @Mock private PayrollForecastRepository forecastRepo;
    @Mock private BankTransactionRepository bankRepo;
    @Mock private PayrollComplianceReportRepository complianceRepo;
    @Mock private PayrollAnomalyRepository anomalyRepo;
    @Mock private PayslipRepository payslipRepo;
    @Mock private OutboxEventRepository outboxEventRepo;

    @InjectMocks
    private PayrollEnterpriseService service;

    private Payslip payslip(long id, String tenantId, String employeeId) {
        Payslip payslip = new Payslip();
        payslip.setId(id);
        payslip.setTenantId(tenantId);
        payslip.setEmployeeId(employeeId);
        payslip.setPeriod("2026-05");
        payslip.setPdfContent("=== PAYSLIP ===\nEmployee: " + employeeId);
        return payslip;
    }

    @Test
    void ownPayslipIsReturned() {
        Payslip own = payslip(1L, "t1", "jane@acme.io");
        when(payslipRepo.findById(1L)).thenReturn(Optional.of(own));

        Optional<Payslip> result = service.getEmployeePayslip("t1", "jane@acme.io", 1L);

        assertTrue(result.isPresent());
        assertEquals(1L, result.get().getId());
    }

    @Test
    void payslipOfAnotherEmployeeIsNotReturned() {
        Payslip other = payslip(7L, "t1", "mallory@acme.io");
        when(payslipRepo.findById(7L)).thenReturn(Optional.of(other));

        // A forged id in the URL resolves to empty rather than to somebody
        // else's payslip.
        assertTrue(service.getEmployeePayslip("t1", "jane@acme.io", 7L).isEmpty());
    }

    @Test
    void payslipOfAnotherTenantIsNotReturned() {
        Payslip otherTenant = payslip(9L, "t2", "jane@acme.io");
        when(payslipRepo.findById(9L)).thenReturn(Optional.of(otherTenant));

        assertTrue(service.getEmployeePayslip("t1", "jane@acme.io", 9L).isEmpty());
    }

    @Test
    void employeeIdentityMatchIsCaseInsensitive() {
        Payslip own = payslip(3L, "t1", "Jane@Acme.io");
        when(payslipRepo.findById(3L)).thenReturn(Optional.of(own));

        assertTrue(service.getEmployeePayslip("t1", "jane@acme.io", 3L).isPresent());
    }

    @Test
    void missingIdentityOrIdNeverQueriesTheRepository() {
        assertTrue(service.getEmployeePayslip("t1", "", 4L).isEmpty());
        assertTrue(service.getEmployeePayslip("t1", "jane@acme.io", null).isEmpty());
        verifyNoInteractions(payslipRepo);
    }
}
