package com.ems.payroll.consumer;

import com.ems.payroll.service.PayrollCompensationService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class PayrollEventConsumer {

    private final PayrollCompensationService compensationService;

    public PayrollEventConsumer(PayrollCompensationService compensationService) {
        this.compensationService = compensationService;
    }

    @RabbitListener(queues = "${payroll.compensation.queue}")
    public void handleCompensationEvent(Map<String, Object> message) {
        String payrollId = (String) message.get("payrollId");
        String reason = (String) message.getOrDefault("reason", "Compensation triggered");
        compensationService.compensatePayroll(payrollId, reason);
    }
}
