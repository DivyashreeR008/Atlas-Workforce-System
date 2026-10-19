package com.atlas.leave;

import java.time.LocalDate;

/** One outbound calendar block for a leave request. */
public record CalendarBlock(
        Long leaveId,
        String employeeId,
        String title,
        LocalDate startDate,
        LocalDate endDate,
        String idempotencyKey) {
}
