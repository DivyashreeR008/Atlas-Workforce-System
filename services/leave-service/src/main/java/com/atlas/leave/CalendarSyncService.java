package com.atlas.leave;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Outbound one-way sync from leave state changes to the user's connected
 * calendar. Rules baked in here:
 * - the idempotency key is (leave id, provider); a re-approval re-targets the
 *   same remote block and the provider key prevents double-booking;
 * - a revoked, unauthenticated, or toggled-off connection is terminal for
 *   the attempt: no provider call and no background retry loop;
 * - a provider 401 marks the connection NEEDS_REAUTH and the state FAILED;
 * - all other failures are retried explicitly from the sync-status view.
 * Callers guard this service: a sync failure must never fail the leave write,
 * parity with the guarded broker publishes in LeaveService.
 */
@Service
public class CalendarSyncService {

    private final CalendarConnectionRepository connections;
    private final CalendarSyncStateRepository states;
    private final CalendarProvider provider;

    public CalendarSyncService(CalendarConnectionRepository connections,
                               CalendarSyncStateRepository states,
                               CalendarProvider provider) {
        this.connections = connections;
        this.states = states;
        this.provider = provider;
    }

    /** Entry point after a leave write. APPROVED publishes, CANCELLED/REJECTED withdraws. */
    public void onLeaveStatusChange(LeaveRecord leave) {
        List<CalendarConnection> userConnections = connections
                .findByTenantIdAndEmployeeId(leave.getTenantId(), leave.getEmployeeId());
        for (CalendarConnection connection : userConnections) {
            try {
                syncOne(leave, connection);
            } catch (Exception e) {
                System.err.println("Calendar sync failed for leave " + leave.getId()
                        + " provider " + connection.getProvider() + ": " + e.getMessage());
            }
        }
    }

    /**
     * Explicit retry from the sync-status view. Resolves the employee via the
     * persisted state, then re-runs the normal sync path for the leave's
     * *current* status as reported by the caller of this endpoint.
     */
    public CalendarSyncState retry(String tenantId, LeaveRecord leave, String providerName) {
        CalendarSyncState state = states.findByLeaveIdAndProvider(leave.getId(), providerName)
                .orElseThrow(() -> new IllegalArgumentException("No calendar sync state for this leave request"));
        if (!state.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("No calendar sync state for this leave request");
        }
        CalendarConnection connection = connections
                .findByTenantIdAndEmployeeIdAndProvider(state.getTenantId(), state.getEmployeeId(), providerName)
                .orElseThrow(() -> new IllegalArgumentException("Calendar connection not found for retry"));
        syncOne(leave, connection);
        return states.findByLeaveIdAndProvider(leave.getId(), providerName).orElse(state);
    }

    // Internals -------------------------------------------------------------

    private void syncOne(LeaveRecord leave, CalendarConnection connection) {
        CalendarBlock block = blockFor(leave, connection.getProvider());
        CalendarSyncState state = states.findByLeaveIdAndProvider(leave.getId(), connection.getProvider())
                .orElseGet(() -> {
                    CalendarSyncState fresh = new CalendarSyncState();
                    fresh.setTenantId(leave.getTenantId());
                    fresh.setLeaveId(leave.getId());
                    fresh.setEmployeeId(leave.getEmployeeId());
                    fresh.setProvider(connection.getProvider());
                    fresh.setIdempotencyKey("leave-" + leave.getId() + "-"
                            + connection.getProvider().toLowerCase());
                    return fresh;
                });
        state.setLastAttemptAt(Instant.now());
        state.setUpdatedAt(Instant.now());

        if (!connection.isPublishable()) {
            // Revoked, stale credential, or paused toggle: terminal, no call.
            state.setStatus(CalendarSyncState.Status.SKIPPED);
            state.setFailureReason("calendar connection is " + connection.getStatus().name()
                    + (connection.isSyncEnabled() ? "" : " / sync paused"));
            states.save(state);
            return;
        }

        try {
            switch (leave.getStatus()) {
                case APPROVED -> {
                    if (state.getExternalEventId() != null) {
                        provider.updateEvent(connection, state.getExternalEventId(), block);
                    } else {
                        state.setExternalEventId(provider.upsertEvent(connection, block));
                    }
                    state.setStatus(CalendarSyncState.Status.SYNCED);
                    state.setFailureReason(null);
                }
                case CANCELLED, REJECTED -> {
                    if (state.getExternalEventId() != null) {
                        provider.deleteEvent(connection, state.getExternalEventId());
                        state.setExternalEventId(null);
                    }
                    state.setStatus(CalendarSyncState.Status.DELETED);
                    state.setFailureReason(null);
                }
                default -> { /* PENDING: no calendar block until approval */ }
            }
            states.save(state);
        } catch (CalendarUnauthorizedException e) {
            connection.setStatus(CalendarConnection.Status.NEEDS_REAUTH);
            connections.save(connection);
            state.setStatus(CalendarSyncState.Status.FAILED);
            state.setFailureReason("unauthorized: calendar access must be re-granted");
            states.save(state);
        } catch (Exception e) {
            state.setRetryCount(state.getRetryCount() + 1);
            state.setStatus(CalendarSyncState.Status.FAILED);
            state.setFailureReason(truncate(e.getMessage()));
            states.save(state);
        }
        if (state.getStatus() == CalendarSyncState.Status.SYNCED) {
            connection.setLastSyncedAt(Instant.now());
            connections.save(connection);
        }
    }

    private static CalendarBlock blockFor(LeaveRecord leave, String providerName) {
        return new CalendarBlock(
                leave.getId(),
                leave.getEmployeeId(),
                "Leave: " + leave.getLeaveType(),
                leave.getStartDate(),
                leave.getEndDate(),
                "leave-" + leave.getId() + "-" + providerName.toLowerCase());
    }

    private static String truncate(String message) {
        if (message == null) {
            return "unknown provider error";
        }
        return message.length() > 500 ? message.substring(0, 500) : message;
    }
}
