package com.atlas.leave;

/**
 * Thrown when the provider answers 401/403. Terminal for the sync attempt:
 * the service must not retry in a loop, it must flag the connection for
 * re-authentication instead.
 */
public class CalendarUnauthorizedException extends RuntimeException {

    public CalendarUnauthorizedException(String message) {
        super(message);
    }
}
