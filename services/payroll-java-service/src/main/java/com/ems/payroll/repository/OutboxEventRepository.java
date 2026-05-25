package com.ems.payroll.repository;

import com.ems.payroll.model.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    List<OutboxEvent> findByStatusOrderByCreatedAtAsc(String status);
    List<OutboxEvent> findByStatusAndRetryCountLessThan(String status, int maxRetries);
}
