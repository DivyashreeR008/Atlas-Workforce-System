package com.atlas.performance.controller;

import com.atlas.performance.model.PerformanceReview;
import com.atlas.performance.service.PerformanceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/reviews")
@CrossOrigin(origins = "${ALLOWED_ORIGINS:http://localhost:3000}")
public class PerformanceReviewController {

    private final PerformanceService service;

    public PerformanceReviewController(PerformanceService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<PerformanceReview>> listReviews(
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId,
            @RequestParam(required = false) String employeeId,
            @RequestParam(required = false) String reviewerId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cycle) {
        return ResponseEntity.ok(service.getReviews(tenantId, employeeId, reviewerId, status, cycle));
    }

    @PostMapping
    public ResponseEntity<?> createReview(
            @RequestBody PerformanceReview review,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        try {
            return ResponseEntity.ok(service.createReview(tenantId, review));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getReview(
            @PathVariable String id,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        try {
            return ResponseEntity.ok(service.getReview(tenantId, id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateReview(
            @PathVariable String id,
            @RequestBody PerformanceReview review,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        try {
            return ResponseEntity.ok(service.updateReview(tenantId, id, review));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}/submit")
    public ResponseEntity<?> submitReview(
            @PathVariable String id,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        try {
            return ResponseEntity.ok(service.submitReview(tenantId, id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}/acknowledge")
    public ResponseEntity<?> acknowledgeReview(
            @PathVariable String id,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        try {
            return ResponseEntity.ok(service.acknowledgeReview(tenantId, id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/cycle/{cycle}")
    public ResponseEntity<List<PerformanceReview>> getReviewsByCycle(
            @PathVariable String cycle,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(service.getReviewsByCycle(tenantId, cycle));
    }

    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<List<PerformanceReview>> getReviewHistory(
            @PathVariable String employeeId,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(service.getReviewHistory(tenantId, employeeId));
    }
}
