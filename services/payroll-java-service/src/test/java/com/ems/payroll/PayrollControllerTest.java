package com.ems.payroll;

import com.atlas.common.security.TenantIdArgumentResolver;
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
class PayrollControllerTest {

    @Mock
    private PayrollService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new PayrollController(service))
                .setCustomArgumentResolvers(new TenantIdArgumentResolver())
                .build();
    }

    @Test
    void omittedBaseSalaryIsRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/payroll/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"allowances\":\"100.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("baseSalary is required"));

        verify(service, never()).runPayroll(anyString(), anyString(), anyString(), any(), any(), any());
    }

    @Test
    void omittedAllowancesAndDeductionsAreRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/payroll/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"5000.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("allowances is required"));

        mockMvc.perform(post("/api/payroll/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"5000.00\",\"allowances\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("deductions is required"));

        verify(service, never()).runPayroll(anyString(), anyString(), anyString(), any(), any(), any());
    }

    @Test
    void blankMoneyFieldIsRejectedAsAbsent() throws Exception {
        mockMvc.perform(post("/api/payroll/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"  \",\"allowances\":\"0.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("baseSalary is required"));
    }

    @Test
    void presentMoneyFieldsReachTheService() throws Exception {
        when(service.runPayroll(anyString(), anyString(), anyString(), any(), any(), any()))
                .thenReturn(new PayrollRecord());

        mockMvc.perform(post("/api/payroll/run")
                        .requestAttr(TenantIdArgumentResolver.TENANT_ID_ATTRIBUTE, "t1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":\"e1\",\"period\":\"2026-01\","
                                + "\"baseSalary\":\"5000.00\",\"allowances\":\"0.00\",\"deductions\":\"0.00\"}"))
                .andExpect(status().isOk());
    }
}
