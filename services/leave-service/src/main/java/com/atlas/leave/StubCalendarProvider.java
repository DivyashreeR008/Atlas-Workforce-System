package com.atlas.leave;

import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * Deterministic in-memory provider used until a real Google OAuth client is
 * wired in (CI never talks to a real calendar). Behavior map:
 * - a blank connection authRef is treated as an expired token -> 401;
 * - otherwise upserts keyed by the idempotency key, so replaying the same
 *   approval returns the same event id without creating a second block.
 * GET/Outlook and a real provider are explicit follow-ups.
 */
@Component
public class StubCalendarProvider implements CalendarProvider {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final Map<String, String> eventsByKey = new HashMap<>();

    @Override
    public synchronized String upsertEvent(CalendarConnection connection, CalendarBlock block) {
        requireUsable(connection);
        String existing = eventsByKey.get(block.idempotencyKey());
        if (existing != null) {
            return existing;
        }
        String eventId = "stub-" + connection.getProvider().toLowerCase()
                + "-" + Integer.toHexString(block.hashCode()) + "-" + eventsByKey.size();
        eventsByKey.put(block.idempotencyKey(), eventId);
        return eventId;
    }

    @Override
    public synchronized void updateEvent(CalendarConnection connection, String externalEventId, CalendarBlock block) {
        requireUsable(connection);
        if (!eventsByKey.containsValue(externalEventId)) {
            throw new IllegalStateException("stub provider: unknown event " + externalEventId);
        }
    }

    @Override
    public synchronized void deleteEvent(CalendarConnection connection, String externalEventId) {
        requireUsable(connection);
        eventsByKey.values().removeIf(id -> id.equals(externalEventId));
    }

    private static void requireUsable(CalendarConnection connection) {
        if (connection.getAuthRef() == null || connection.getAuthRef().isBlank()) {
            throw new CalendarUnauthorizedException("no usable calendar credential for " + connection.getProvider());
        }
    }
}
