package com.atlas.leave;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CalendarSyncServiceTest {

    @Mock
    private CalendarConnectionRepository connections;
    @Mock
    private CalendarSyncStateRepository states;
    @Mock
    private CalendarProvider provider;

    private CalendarSyncService service;
    private StubConnectionBuilder conn;

    @BeforeEach
    void setUp() {
        service = new CalendarSyncService(connections, states, provider);
        conn = new StubConnectionBuilder();
        when(states.save(any(CalendarSyncState.class))).thenAnswer(inv -> inv.getArgument(0));
        when(states.findByLeaveIdAndProvider(any(), anyString())).thenReturn(Optional.empty());
        when(connections.save(any(CalendarConnection.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static final class StubConnectionBuilder {
        CalendarConnection active() {
            CalendarConnection connection = new CalendarConnection();
            connection.setTenantId("t1");
            connection.setEmployeeId("e1");
            connection.setProvider("GOOGLE");
            connection.setStatus(CalendarConnection.Status.ACTIVE);
            connection.setSyncEnabled(true);
            connection.setAuthRef("valid-token");
            connection.setCreatedAt(Instant.now());
            return connection;
        }
    }

    private LeaveRecord leave(LeaveStatus status) {
        LeaveRecord leave = new LeaveRecord();
        leave.setId(7L);
        leave.setVersion(0L);
        leave.setTenantId("t1");
        leave.setEmployeeId("e1");
        leave.setStartDate(LocalDate.of(2026, 11, 2));
        leave.setEndDate(LocalDate.of(2026, 11, 4));
        leave.setLeaveType("VACATION");
        leave.setStatus(status);
        return leave;
    }

    private void activeConnection() {
        when(connections.findByTenantIdAndEmployeeId("t1", "e1"))
                .thenReturn(List.of(conn.active()));
    }

    @Test
    void approvalCreatesAnEventAndMarkedSynced() {
        activeConnection();
        when(provider.upsertEvent(any(), any())).thenReturn("evt-1");

        service.onLeaveStatusChange(leave(LeaveStatus.APPROVED));

        ArgumentCaptor<CalendarBlock> block = ArgumentCaptor.forClass(CalendarBlock.class);
        verify(provider).upsertEvent(any(CalendarConnection.class), block.capture());
        assertEquals("leave-7-GOOGLE", block.getValue().idempotencyKey());
        ArgumentCaptor<CalendarSyncState> saved = ArgumentCaptor.forClass(CalendarSyncState.class);
        verify(states).save(saved.capture());
        assertEquals(CalendarSyncState.Status.SYNCED, saved.getValue().getStatus());
        assertEquals("evt-1", saved.getValue().getExternalEventId());
    }

    @Test
    void duplicateApprovalUpdatesInsteadOfCreatingASecondEvent() {
        activeConnection();
        CalendarSyncState existing = new CalendarSyncState();
        existing.setTenantId("t1");
        existing.setLeaveId(7L);
        existing.setEmployeeId("e1");
        existing.setProvider("GOOGLE");
        existing.setIdempotencyKey("leave-7-GOOGLE");
        existing.setExternalEventId("evt-1");
        existing.setStatus(CalendarSyncState.Status.SYNCED);
        when(states.findByLeaveIdAndProvider(7L, "GOOGLE")).thenReturn(Optional.of(existing));
        when(provider.upsertEvent(any(), any())).thenReturn("evt-other");

        service.onLeaveStatusChange(leave(LeaveStatus.APPROVED));

        // Create is never called again; the same block is updated in place.
        verify(provider).updateEvent(any(CalendarConnection.class), org.mockito.ArgumentMatchers.eq("evt-1"), any(CalendarBlock.class));
        verify(provider, never()).upsertEvent(any(), any());
    }

    @Test
    void cancellationDeletesThePublishedBlock() {
        activeConnection();
        CalendarSyncState existing = new CalendarSyncState();
        existing.setTenantId("t1");
        existing.setLeaveId(7L);
        existing.setEmployeeId("e1");
        existing.setProvider("GOOGLE");
        existing.setIdempotencyKey("leave-7-GOOGLE");
        existing.setExternalEventId("evt-1");
        existing.setStatus(CalendarSyncState.Status.SYNCED);
        when(states.findByLeaveIdAndProvider(7L, "GOOGLE")).thenReturn(Optional.of(existing));

        service.onLeaveStatusChange(leave(LeaveStatus.CANCELLED));

        verify(provider).deleteEvent(any(CalendarConnection.class), org.mockito.ArgumentMatchers.eq("evt-1"));
        ArgumentCaptor<CalendarSyncState> saved = ArgumentCaptor.forClass(CalendarSyncState.class);
        verify(states).save(saved.capture());
        assertEquals(CalendarSyncState.Status.DELETED, saved.getValue().getStatus());
        assertNull(saved.getValue().getExternalEventId());
    }

    @Test
    void revokedConnectionIsTerminalWithNoProviderCall() {
        CalendarConnection revoked = conn.active();
        revoked.setStatus(CalendarConnection.Status.REVOKED);
        when(connections.findByTenantIdAndEmployeeId("t1", "e1")).thenReturn(List.of(revoked));

        service.onLeaveStatusChange(leave(LeaveStatus.APPROVED));

        verify(provider, never()).upsertEvent(any(), any());
        ArgumentCaptor<CalendarSyncState> saved = ArgumentCaptor.forClass(CalendarSyncState.class);
        verify(states).save(saved.capture());
        assertEquals(CalendarSyncState.Status.SKIPPED, saved.getValue().getStatus());
        assertTrue(saved.getValue().getFailureReason().contains("REVOKED"));
    }

    @Test
    void unauthorizedMarksTheConnectionNeedingReauthAndDoesNotThrow() {
        activeConnection();
        when(provider.upsertEvent(any(), any()))
                .thenThrow(new CalendarUnauthorizedException("expired"));

        service.onLeaveStatusChange(leave(LeaveStatus.APPROVED));

        ArgumentCaptor<CalendarConnection> connection = ArgumentCaptor.forClass(CalendarConnection.class);
        verify(connections).save(connection.capture());
        assertEquals(CalendarConnection.Status.NEEDS_REAUTH, connection.getValue().getStatus());
        ArgumentCaptor<CalendarSyncState> saved = ArgumentCaptor.forClass(CalendarSyncState.class);
        verify(states).save(saved.capture());
        assertEquals(CalendarSyncState.Status.FAILED, saved.getValue().getStatus());
        assertTrue(saved.getValue().getFailureReason().contains("unauthorized"));
    }

    @Test
    void providerFailureIsRecordedWithTheReasonAndIsRetryable() throws Exception {
        activeConnection();
        when(provider.upsertEvent(any(), any())).thenThrow(new RuntimeException("firewall blocked"));

        service.onLeaveStatusChange(leave(LeaveStatus.APPROVED));

        ArgumentCaptor<CalendarSyncState> saved = ArgumentCaptor.forClass(CalendarSyncState.class);
        verify(states).save(saved.capture());
        assertEquals(CalendarSyncState.Status.FAILED, saved.getValue().getStatus());
        assertEquals("firewall blocked", saved.getValue().getFailureReason());
        assertEquals(1, saved.getValue().getRetryCount());
    }

    @Test
    void noConnectedCalendarMeansNoStateAndNoCalls() {
        when(connections.findByTenantIdAndEmployeeId("t1", "e1")).thenReturn(List.of());

        service.onLeaveStatusChange(leave(LeaveStatus.APPROVED));

        verify(provider, never()).upsertEvent(any(), any());
        verify(states, never()).save(any(CalendarSyncState.class));
    }

    @Test
    void pendingLeavesProduceNoCalendarBlock() {
        activeConnection();

        service.onLeaveStatusChange(leave(LeaveStatus.PENDING));

        verify(provider, never()).upsertEvent(any(), any());
        verify(provider, never()).updateEvent(any(), anyString(), any());
    }
}
