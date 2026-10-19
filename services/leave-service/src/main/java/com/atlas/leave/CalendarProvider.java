package com.atlas.leave;

/**
 * Outbound calendar provider port. One-way writes only (atlas -> calendar);
 * reading events back is an explicit follow-up. Implementations must honor
 * the idempotency key on create so a replayed approval cannot double-book.
 */
public interface CalendarProvider {

    /**
     * Creates (or upserts, keyed by the idempotency key) an event for the
     * given block and returns the provider event id.
     */
    String upsertEvent(CalendarConnection connection, CalendarBlock block);

    /** Updates an existing event. */
    void updateEvent(CalendarConnection connection, String externalEventId, CalendarBlock block);

    /** Deletes an existing event; deleting an already-gone event must not throw. */
    void deleteEvent(CalendarConnection connection, String externalEventId);
}
