package com.atlas.leave;

import java.time.LocalDate;

/**
 * Represents the possible states of a leave request.
 * Enforces valid status transitions via {@link #isValidTransition(LeaveStatus, LeaveStatus, String, LocalDate)}.
 */
public enum LeaveStatus {
    PENDING,
    APPROVED,
    REJECTED,
    CANCELLED;

    /**
     * Determines whether a transition from {@code current} to {@code next} is allowed
     * for a caller with the given {@code userRole}.
     *
     * <p>Valid transitions:
     * <ul>
     *   <li>PENDING  → APPROVED   (manager / admin)</li>
     *   <li>PENDING  → REJECTED   (manager / admin)</li>
     *   <li>PENDING  → CANCELLED  (employee only)</li>
     *   <li>APPROVED → CANCELLED  (employee only, before start date)</li>
     *   <li>All other transitions are invalid.</li>
     * </ul>
     *
     * @param current   the current status of the leave record (must not be null)
     * @param next      the desired new status (must not be null)
     * @param userRole  the role of the caller (admin / manager / employee)
     * @param startDate the start date of the leave; used only for the
     *                  APPROVED → CANCELLED transition check
     * @return {@code true} if the transition is permitted
     */
    public static boolean isValidTransition(LeaveStatus current, LeaveStatus next, String userRole, LocalDate startDate) {
        if (current == null || next == null || userRole == null) {
            return false;
        }
        String role = userRole.trim().toLowerCase();

        return switch (current) {
            case PENDING -> switch (next) {
                case APPROVED  -> "admin".equals(role) || "manager".equals(role);
                case REJECTED  -> "admin".equals(role) || "manager".equals(role);
                case CANCELLED -> "employee".equals(role);
                default        -> false;
            };
            case APPROVED -> switch (next) {
                case CANCELLED -> "employee".equals(role)
                                  && startDate != null
                                  && startDate.isAfter(LocalDate.now());
                default        -> false;
            };
            // REJECTED and CANCELLED are terminal — no outgoing transitions
            case REJECTED, CANCELLED -> false;
        };
    }
}
