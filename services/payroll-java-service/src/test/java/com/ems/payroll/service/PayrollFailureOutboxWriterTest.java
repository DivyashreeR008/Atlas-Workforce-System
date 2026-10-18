package com.ems.payroll.service;

import com.ems.payroll.model.OutboxEvent;
import com.ems.payroll.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PayrollFailureOutboxWriterTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @InjectMocks
    private PayrollFailureOutboxWriter writer;

    @Test
    void recordFailureStoresAPendingPayrollFailedEvent() {
        when(outboxEventRepository.save(any(OutboxEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        writer.recordFailure("t1", "e1", "2026-01", "boom");

        ArgumentCaptor<OutboxEvent> saved = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(saved.capture());
        OutboxEvent event = saved.getValue();
        assertEquals("payroll", event.getAggregateType());
        assertEquals("0", event.getAggregateId());
        assertEquals("PAYROLL_FAILED", event.getEventType());
        assertEquals("PENDING", event.getStatus());
        assertEquals(0, event.getRetryCount());
        assertNotNull(event.getCreatedAt());
        assertTrue(event.getPayload().contains("\"employeeId\":\"e1\""));
        assertTrue(event.getPayload().contains("\"period\":\"2026-01\""));
        assertTrue(event.getPayload().contains("\"error\":\"boom\""));
        assertTrue(event.getPayload().contains("\"tenantId\":\"t1\""));
    }

    @Test
    void aNullErrorMessageStillProducesAPersistablePayload() {
        when(outboxEventRepository.save(any(OutboxEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        writer.recordFailure("t1", "e1", "2026-01", null);

        ArgumentCaptor<OutboxEvent> saved = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(saved.capture());
        // Map.of would have thrown on the null value; the payload must exist.
        assertNotNull(saved.getValue().getPayload());
    }

    @Test
    void recordFailureCommitsInItsOwnTransaction() throws Exception {
        Method method = PayrollFailureOutboxWriter.class.getMethod(
                "recordFailure", String.class, String.class, String.class, String.class);
        Transactional transactional = method.getAnnotation(Transactional.class);
        assertNotNull(transactional, "recordFailure must be transactional");
        assertEquals(Propagation.REQUIRES_NEW, transactional.propagation(),
                "the failure event must commit even when the payroll transaction rolls back");
    }
}
