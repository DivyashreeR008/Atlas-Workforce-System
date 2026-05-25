package com.ems.payroll.controller;

import com.ems.payroll.model.*;
import com.ems.payroll.service.PayrollEnterpriseService;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payroll/enterprise")
@CrossOrigin(origins = "${ALLOWED_ORIGINS:http://localhost:3000}")
@Validated
public class PayrollEnterpriseController {

    private final PayrollEnterpriseService service;

    public PayrollEnterpriseController(PayrollEnterpriseService service) {
        this.service = service;
    }

    // ============================================================
    // Dashboard
    // ============================================================
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getDashboardSummary(tenantId));
    }

    // ============================================================
    // Multi-country payroll
    // ============================================================
    @GetMapping("/payrolls")
    public ResponseEntity<List<EnhancedPayrollRecord>> getPayrolls(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getAllPayrolls(tenantId));
    }

    @GetMapping("/payrolls/employee/{employeeId}")
    public ResponseEntity<List<EnhancedPayrollRecord>> getPayrollsByEmployee(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String employeeId) {
        return ResponseEntity.ok(service.getPayrollsByEmployee(tenantId, employeeId));
    }

    @GetMapping("/payrolls/period/{period}")
    public ResponseEntity<List<EnhancedPayrollRecord>> getPayrollsByPeriod(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String period) {
        return ResponseEntity.ok(service.getPayrollsByPeriod(tenantId, period));
    }

    @PostMapping("/payrolls/run")
    public ResponseEntity<?> runPayroll(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        try {
            EnhancedPayrollRecord record = service.runMultiCountryPayroll(
                    tenantId,
                    (String) req.get("employeeId"),
                    (String) req.get("period"),
                    Double.valueOf(req.getOrDefault("baseSalary", "0").toString()),
                    Double.valueOf(req.getOrDefault("allowances", "0").toString()),
                    Double.valueOf(req.getOrDefault("deductions", "0").toString()),
                    (String) req.getOrDefault("country", "US"),
                    (String) req.getOrDefault("currency", "USD"));
            return ResponseEntity.ok(record);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ============================================================
    // Tax config
    // ============================================================
    @GetMapping("/tax-configs")
    public ResponseEntity<List<CountryTaxConfig>> getTaxConfigs(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getTaxConfigs(tenantId));
    }

    @PostMapping("/tax-configs")
    public ResponseEntity<CountryTaxConfig> saveTaxConfig(
            @RequestBody CountryTaxConfig config) {
        return ResponseEntity.ok(service.saveTaxConfig(config));
    }

    @GetMapping("/tax-brackets")
    public ResponseEntity<List<TaxBracket>> getTaxBrackets(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getTaxBrackets(tenantId));
    }

    @PostMapping("/tax-brackets")
    public ResponseEntity<TaxBracket> saveTaxBracket(
            @RequestBody TaxBracket bracket) {
        return ResponseEntity.ok(service.saveTaxBracket(bracket));
    }

    // ============================================================
    // Tax simulations
    // ============================================================
    @PostMapping("/tax/simulate")
    public ResponseEntity<Map<String, Object>> simulateTax(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        String country = (String) req.getOrDefault("country", "US");
        Double grossSalary = Double.valueOf(req.getOrDefault("grossSalary", "0").toString());
        return ResponseEntity.ok(service.simulateTax(tenantId, country, grossSalary));
    }

    @PostMapping("/tax/compare")
    public ResponseEntity<List<Map<String, Object>>> compareTax(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        @SuppressWarnings("unchecked")
        List<String> countries = (List<String>) req.getOrDefault("countries", List.of("US"));
        Double grossSalary = Double.valueOf(req.getOrDefault("grossSalary", "0").toString());
        return ResponseEntity.ok(service.compareCountryTax(tenantId, countries, grossSalary));
    }

    // ============================================================
    // Payroll forecasting
    // ============================================================
    @PostMapping("/forecasts/generate")
    public ResponseEntity<PayrollForecast> generateForecast(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, String> req) {
        String period = req.getOrDefault("period", "2026-Q2");
        return ResponseEntity.ok(service.generateForecast(tenantId, period));
    }

    @GetMapping("/forecasts")
    public ResponseEntity<List<PayrollForecast>> getForecasts(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getForecasts(tenantId));
    }

    // ============================================================
    // Payroll auditing
    // ============================================================
    @GetMapping("/audit-logs")
    public ResponseEntity<List<PayrollAudit>> getAuditLogs(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getAuditLogs(tenantId));
    }

    // ============================================================
    // Payslip generation
    // ============================================================
    @GetMapping("/payslips")
    public ResponseEntity<List<Payslip>> getPayslips(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getPayslips(tenantId));
    }

    @GetMapping("/payslips/employee/{employeeId}")
    public ResponseEntity<List<Payslip>> getEmployeePayslips(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String employeeId) {
        return ResponseEntity.ok(service.getEmployeePayslips(tenantId, employeeId));
    }

    // ============================================================
    // Bank integration
    // ============================================================
    @PostMapping("/bank/transactions")
    public ResponseEntity<BankTransaction> createBankTransaction(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        BankTransaction tx = service.createBankTransaction(
                tenantId,
                Long.valueOf(req.getOrDefault("payrollId", "0").toString()),
                (String) req.get("employeeId"),
                Double.valueOf(req.getOrDefault("amount", "0").toString()),
                (String) req.get("accountNumber"),
                (String) req.get("routingNumber"),
                (String) req.getOrDefault("bankName", ""));
        return ResponseEntity.ok(tx);
    }

    @GetMapping("/bank/transactions")
    public ResponseEntity<List<BankTransaction>> getBankTransactions(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getBankTransactions(tenantId));
    }

    @PostMapping("/bank/transactions/{id}/process")
    public ResponseEntity<BankTransaction> processBankTransaction(@PathVariable Long id) {
        return ResponseEntity.ok(service.processBankTransaction(id));
    }

    // ============================================================
    // Expense reimbursements
    // ============================================================
    @GetMapping("/expenses")
    public ResponseEntity<List<ExpenseReport>> getExpenses(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getExpenses(tenantId));
    }

    @GetMapping("/expenses/employee/{employeeId}")
    public ResponseEntity<List<ExpenseReport>> getExpensesByEmployee(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String employeeId) {
        return ResponseEntity.ok(service.getExpensesByEmployee(tenantId, employeeId));
    }

    @PostMapping("/expenses")
    public ResponseEntity<ExpenseReport> submitExpense(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        ExpenseReport expense = service.submitExpense(
                tenantId,
                (String) req.get("employeeId"),
                (String) req.get("category"),
                Double.valueOf(req.getOrDefault("amount", "0").toString()),
                (String) req.getOrDefault("description", ""),
                (String) req.getOrDefault("receiptUrl", ""));
        return ResponseEntity.ok(expense);
    }

    @PostMapping("/expenses/{id}/approve")
    public ResponseEntity<ExpenseReport> approveExpense(
            @PathVariable Long id,
            @RequestBody Map<String, String> req) {
        return ResponseEntity.ok(service.approveExpense(id, req.getOrDefault("approvedBy", "admin")));
    }

    @PostMapping("/expenses/{id}/reject")
    public ResponseEntity<ExpenseReport> rejectExpense(
            @PathVariable Long id,
            @RequestBody Map<String, String> req) {
        return ResponseEntity.ok(service.rejectExpense(id, req.getOrDefault("reason", "No reason provided")));
    }

    // ============================================================
    // Benefits administration
    // ============================================================
    @GetMapping("/benefit-plans")
    public ResponseEntity<List<BenefitPlan>> getBenefitPlans(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getBenefitPlans(tenantId));
    }

    @PostMapping("/benefit-plans")
    public ResponseEntity<BenefitPlan> createBenefitPlan(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        BenefitPlan plan = service.createBenefitPlan(
                tenantId,
                (String) req.get("name"),
                (String) req.get("type"),
                (String) req.getOrDefault("description", ""),
                Double.valueOf(req.getOrDefault("employerContribution", "0").toString()),
                Double.valueOf(req.getOrDefault("employeeContribution", "0").toString()),
                Double.valueOf(req.getOrDefault("maxBenefitAmount", "0").toString()));
        return ResponseEntity.ok(plan);
    }

    @GetMapping("/benefit-enrollments")
    public ResponseEntity<List<BenefitEnrollment>> getBenefitEnrollments(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getBenefitEnrollments(tenantId));
    }

    @PostMapping("/benefit-enrollments")
    public ResponseEntity<BenefitEnrollment> enrollBenefit(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(service.enrollInBenefit(
                tenantId,
                (String) req.get("employeeId"),
                Long.valueOf(req.get("planId").toString())));
    }

    // ============================================================
    // Compensation planning
    // ============================================================
    @GetMapping("/compensation-plans")
    public ResponseEntity<List<CompensationPlan>> getCompensationPlans(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getCompensationPlans(tenantId));
    }

    @PostMapping("/compensation-plans")
    public ResponseEntity<CompensationPlan> createCompensationPlan(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        CompensationPlan plan = service.createCompensationPlan(
                tenantId,
                (String) req.get("employeeId"),
                Double.valueOf(req.getOrDefault("currentSalary", "0").toString()),
                Double.valueOf(req.getOrDefault("proposedSalary", "0").toString()),
                (String) req.getOrDefault("currency", "USD"),
                (String) req.getOrDefault("reason", ""),
                (String) req.getOrDefault("reviewCycle", "annual"));
        return ResponseEntity.ok(plan);
    }

    // ============================================================
    // Bonus management
    // ============================================================
    @GetMapping("/bonuses")
    public ResponseEntity<List<Bonus>> getBonuses(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getBonuses(tenantId));
    }

    @PostMapping("/bonuses")
    public ResponseEntity<Bonus> createBonus(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        Bonus bonus = service.createBonus(
                tenantId,
                (String) req.get("employeeId"),
                Double.valueOf(req.getOrDefault("amount", "0").toString()),
                (String) req.getOrDefault("type", "performance"),
                (String) req.getOrDefault("reason", ""));
        return ResponseEntity.ok(bonus);
    }

    @PostMapping("/bonuses/{id}/approve")
    public ResponseEntity<Bonus> approveBonus(
            @PathVariable Long id,
            @RequestBody Map<String, String> req) {
        return ResponseEntity.ok(service.approveBonus(id, req.getOrDefault("approvedBy", "admin")));
    }

    // ============================================================
    // Equity management
    // ============================================================
    @GetMapping("/equity")
    public ResponseEntity<List<EquityGrant>> getEquity(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getEquityGrants(tenantId));
    }

    @PostMapping("/equity")
    public ResponseEntity<EquityGrant> createEquityGrant(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        EquityGrant grant = service.createEquityGrant(
                tenantId,
                (String) req.get("employeeId"),
                Double.valueOf(req.getOrDefault("shares", "0").toString()),
                Double.valueOf(req.getOrDefault("strikePrice", "0").toString()),
                Double.valueOf(req.getOrDefault("fairMarketValue", "0").toString()),
                (String) req.getOrDefault("equityType", "NSO"),
                (String) req.getOrDefault("vestingSchedule", "4-year standard"));
        return ResponseEntity.ok(grant);
    }

    @GetMapping("/equity/employee/{employeeId}")
    public ResponseEntity<List<EquityGrant>> getEmployeeEquity(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String employeeId) {
        return ResponseEntity.ok(service.getEmployeeEquity(tenantId, employeeId));
    }

    // ============================================================
    // Salary benchmarking
    // ============================================================
    @GetMapping("/benchmarks")
    public ResponseEntity<List<SalaryBenchmark>> getBenchmarks(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getBenchmarks(tenantId));
    }

    @PostMapping("/benchmarks")
    public ResponseEntity<SalaryBenchmark> addBenchmark(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        SalaryBenchmark benchmark = service.addBenchmark(
                tenantId,
                (String) req.get("role"),
                (String) req.getOrDefault("experience", "mid"),
                (String) req.getOrDefault("location", ""),
                Double.valueOf(req.getOrDefault("p10", "0").toString()),
                Double.valueOf(req.getOrDefault("p25", "0").toString()),
                Double.valueOf(req.getOrDefault("p50", "0").toString()),
                Double.valueOf(req.getOrDefault("p75", "0").toString()),
                Double.valueOf(req.getOrDefault("p90", "0").toString()),
                (String) req.getOrDefault("currency", "USD"),
                (String) req.getOrDefault("source", "internal"));
        return ResponseEntity.ok(benchmark);
    }

    @PostMapping("/benchmarks/compare")
    public ResponseEntity<Map<String, Object>> compareBenchmark(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, Object> req) {
        return ResponseEntity.ok(service.compareToBenchmark(
                tenantId,
                (String) req.get("role"),
                (String) req.getOrDefault("experience", "mid"),
                (String) req.getOrDefault("location", ""),
                Double.valueOf(req.getOrDefault("currentSalary", "0").toString())));
    }

    // ============================================================
    // Compliance reports
    // ============================================================
    @GetMapping("/compliance-reports")
    public ResponseEntity<List<PayrollComplianceReport>> getComplianceReports(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getComplianceReports(tenantId));
    }

    @PostMapping("/compliance-reports/generate")
    public ResponseEntity<PayrollComplianceReport> generateComplianceReport(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody Map<String, String> req) {
        return ResponseEntity.ok(service.generateComplianceReport(
                tenantId,
                req.getOrDefault("reportType", "TAX"),
                req.getOrDefault("period", ""),
                req.getOrDefault("country", "US")));
    }

    // ============================================================
    // Anomaly detection
    // ============================================================
    @GetMapping("/anomalies")
    public ResponseEntity<List<PayrollAnomaly>> getAnomalies(
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.getAnomalies(tenantId));
    }

    @PostMapping("/anomalies/{id}/resolve")
    public ResponseEntity<PayrollAnomaly> resolveAnomaly(
            @PathVariable Long id,
            @RequestHeader("X-Tenant-Id") String tenantId) {
        return ResponseEntity.ok(service.resolveAnomaly(id, tenantId));
    }
}
