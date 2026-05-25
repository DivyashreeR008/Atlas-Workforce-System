package com.atlas.performance.controller;

import com.atlas.performance.service.PerformanceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
@CrossOrigin(origins = "${ALLOWED_ORIGINS:http://localhost:3000}")
public class AnalyticsController {

    private final PerformanceService service;

    public AnalyticsController(PerformanceService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview(
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(service.getAnalyticsOverview(tenantId));
    }

    @GetMapping("/department-ratings")
    public ResponseEntity<Map<String, Object>> getDepartmentRatings(
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(service.getDepartmentRatings(tenantId));
    }

    @GetMapping("/goal-completion")
    public ResponseEntity<Map<String, Object>> getGoalCompletion(
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(service.getGoalCompletionRates(tenantId));
    }

    @GetMapping("/succession-readiness")
    public ResponseEntity<Map<String, Object>> getSuccessionReadiness(
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(service.getSuccessionReadiness(tenantId));
    }
}
