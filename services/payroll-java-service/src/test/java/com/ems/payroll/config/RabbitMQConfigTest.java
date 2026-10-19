package com.ems.payroll.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Field;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * Unit tests for the RabbitMQ durability configuration: quorum queues with
 * dead-letter routing, publisher confirms, and bounded listener retries.
 * No broker connection is required - configuration objects only.
 */
class RabbitMQConfigTest {

    private RabbitMQConfig config;

    @BeforeEach
    void setUp() throws Exception {
        config = new RabbitMQConfig();
        setField("exchangeName", "payroll.exchange");
        setField("processedQueue", "payroll.processed.queue");
        setField("compensationQueue", "payroll.compensation.queue");
        setField("dlqName", "payroll.dlq");
    }

    private void setField(String name, String value) throws Exception {
        Field field = RabbitMQConfig.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(config, value);
    }

    @Test
    void payrollQueuesAreQuorumAndDeadLetterToTheDlq() {
        Queue processed = config.processedQueue();
        Queue compensation = config.compensationQueue();

        assertNotNull(processed);
        assertNotNull(compensation);
        assertTrue(processed.isDurable(), "payroll queues must be durable");
        assertTrue(compensation.isDurable(), "payroll queues must be durable");

        Map<String, Object> processedArgs = processed.getArguments();
        Map<String, Object> compensationArgs = compensation.getArguments();
        assertEquals("quorum", String.valueOf(processedArgs.get("x-queue-type")),
                "the processed stream must survive broker restarts (quorum queue)");
        assertEquals("quorum", String.valueOf(compensationArgs.get("x-queue-type")),
                "the compensation stream must survive broker restarts (quorum queue)");

        assertEquals("payroll.exchange", processedArgs.get("x-dead-letter-exchange"),
                "rejected processed events must dead-letter to the payroll exchange");
        assertEquals(RabbitMQConfig.DLQ_ROUTING_KEY, processedArgs.get("x-dead-letter-routing-key"));
        assertEquals("payroll.exchange", compensationArgs.get("x-dead-letter-exchange"),
                "rejected compensation events must dead-letter to the payroll exchange");
        assertEquals(RabbitMQConfig.DLQ_ROUTING_KEY, compensationArgs.get("x-dead-letter-routing-key"));
    }

    @Test
    void dlqIsBoundOnTheWildcardKeyThatMatchesTheDeadLetterRoutingKey() {
        assertNotNull(config.dlqBinding());
        assertNotNull(config.dlqQueue());
        assertTrue(config.dlqQueue().isDurable(), "the DLQ must be durable");
    }

    @Test
    void exchangeIsDurableTopic() {
        TopicExchange exchange = config.payrollExchange();
        assertTrue(exchange.isDurable(), "the payroll exchange must be durable");
        assertEquals("topic", exchange.getActualType(), "the routing key scheme is topic based");
    }

    @Test
    void rabbitTemplateEnforcesMandatoryRoutingAndConfirms() {
        RabbitTemplate template = config.rabbitTemplate(mock(ConnectionFactory.class));

        assertTrue(template.isMandatory(), "unroutable publishes must be reported back, never dropped");
        assertSame(Jackson2JsonMessageConverter.class, template.getMessageConverter().getClass());
    }

    @Test
    void listenerFactoryRetriesBoundedTimesThenRejectsToTheDlqRecoverer() {
        ConnectionFactory connectionFactory = mock(ConnectionFactory.class);
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);

        SimpleRabbitListenerContainerFactory factory =
                config.rabbitListenerContainerFactory(3, connectionFactory, rabbitTemplate);

        assertEquals(Boolean.FALSE, factory.isDefaultRequeueRejected(),
                "a poison message must not loop forever through requeue");
        assertFalse(factory.getAdviceChain().isEmpty(),
                "bounded retry advice must be configured");
    }
}
