package com.ems.payroll.controller;

import com.atlas.common.security.TenantIdArgumentResolver;
import com.ems.payroll.model.EnhancedPayrollRecord;
import com.ems.payroll.service.PayrollEnterpriseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PayrollEnterpriseControllerTest {

    @Mock
    private PayrollEnterpriseService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new PayrollEnterpriseController(service))
                .setCustomArgumentResolvers(new TenantIdArgumentResolver())
                .build();
    }

    @Test
    void omittedBaseSalaryIsRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/payroll/enterprise/payrolls/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"allowances\":\"100.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("baseSalary is required"));

        verify(service, never()).runMultiCountryPayroll(anyString(), anyString(), anyString(),
                any(), any(), any(), anyString(), anyString());
    }

    @Test
    void omittedAllowancesAndDeductionsAreRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/payroll/enterprise/payrolls/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"5000.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("allowances is required"));

        mockMvc.perform(post("/api/payroll/enterprise/payrolls/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"5000.00\",\"allowances\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("deductions is required"));

        verify(service, never()).runMultiCountryPayroll(anyString(), anyString(), anyString(),
                any(), any(), any(), anyString(), anyString());
    }

    @Test
    void presentMoneyFieldsReachTheService() throws Exception {
        when(service.runMultiCountryPayroll(anyString(), anyString(), anyString(),
                any(), any(), any(), anyString(), anyString()))
                .thenReturn(new EnhancedPayrollRecord());

        mockMvc.perform(post("/api/payroll/enterprise/payrolls/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"5000.00\",\"allowances\":\"0.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isOk());
    }
}
