package com.ems.payroll.service;

import com.ems.payroll.model.OutboxEvent;
import com.ems.payroll.repository.OutboxEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Writes PAYROLL_FAILED outbox events in their own transaction.
 *
 * <p>The payroll run methods rethrow out of a transactional scope, so an
 * outbox row written inside that transaction would roll back together with the
 * failure it is supposed to record. With {@link Propagation#REQUIRES_NEW} the
 * failure event commits independently and the runs that most need
 * investigating are the ones that leave a trace.
 */
@Service
public class PayrollFailureOutboxWriter {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final OutboxEventRepository outboxEventRepository;

    public PayrollFailureOutboxWriter(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OutboxEvent recordFailure(String tenantId, String employeeId, String period, String errorMessage) {
        OutboxEvent outboxEvent = new OutboxEvent();
        outboxEvent.setAggregateType("payroll");
        outboxEvent.setAggregateId("0");
        outboxEvent.setEventType("PAYROLL_FAILED");
        // LinkedHashMap instead of Map.of so a null error message cannot turn
        // the failure handler into its own failure.
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("employeeId", employeeId);
        payload.put("period", period);
        payload.put("error", errorMessage);
        payload.put("timestamp", LocalDateTime.now().toString());
        payload.put("tenantId", tenantId);
        outboxEvent.setPayload(toJson(payload));
        outboxEvent.setStatus("PENDING");
        outboxEvent.setRetryCount(0);
        outboxEvent.setCreatedAt(LocalDateTime.now());
        return outboxEventRepository.save(outboxEvent);
    }

    private static String toJson(Map<String, Object> payload) {
        try {
            return MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize outbox payload", e);
        }
    }
}
