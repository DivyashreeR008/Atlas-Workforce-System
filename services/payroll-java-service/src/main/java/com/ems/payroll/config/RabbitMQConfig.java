package com.ems.payroll.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.retry.RepublishMessageRecoverer;
import org.springframework.amqp.rabbit.retry.RetryInterceptorBuilder;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    /**
     * Routing key used for dead-lettered payroll events. The payroll DLQ is
     * bound to the same topic exchange with "payroll.dlq.*", so rejected or
     * exceeded-retry messages land there with all headers preserved.
     */
    public static final String DLQ_ROUTING_KEY = "payroll.dlq.rejected";

    @Value("${payroll.exchange.name}")
    private String exchangeName;

    @Value("${payroll.processed.queue}")
    private String processedQueue;

    @Value("${payroll.compensation.queue}")
    private String compensationQueue;

    @Value("${payroll.dlq.name}")
    private String dlqName;

    @Bean
    public TopicExchange payrollExchange() {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue processedQueue() {
        // Quorum queues keep payroll events durable across broker restarts and
        // node loss; dead-lettering diverts poison messages instead of
        // requeuing them forever.
        return QueueBuilder.durable(processedQueue)
                .quorum()
                .deadLetterExchange(exchangeName)
                .deadLetterRoutingKey(DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Queue compensationQueue() {
        return QueueBuilder.durable(compensationQueue)
                .quorum()
                .deadLetterExchange(exchangeName)
                .deadLetterRoutingKey(DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Queue dlqQueue() {
        return new Queue(dlqName, true);
    }

    @Bean
    public Binding processedBinding() {
        return BindingBuilder.bind(processedQueue())
                .to(payrollExchange())
                .with("payroll.processed.*");
    }

    @Bean
    public Binding compensationBinding() {
        return BindingBuilder.bind(compensationQueue())
                .to(payrollExchange())
                .with("payroll.compensation.*");
    }

    @Bean
    public Binding dlqBinding() {
        return BindingBuilder.bind(dlqQueue())
                .to(payrollExchange())
                .with("payroll.dlq.*");
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        // Publisher confirms make the outbox delivery contract at-least-once:
        // an unconfirmed publish, a nack, or an unroutable mandatory routing
        // key surfaces here or at the send call instead of dropping the event,
        // and the outbox's existing retry loop republishes it.
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter());
        rabbitTemplate.setMandatory(true);
        rabbitTemplate.setReturnsCallback(returned -> log.error(
                "Unroutable payroll event: routingKey={} replyText={}",
                returned.getRoutingKey(), returned.getReplyText()));
        rabbitTemplate.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Publisher nacked (event={}): {}",
                        correlationData != null ? correlationData.getId() : "unknown", cause);
            }
        });
        return rabbitTemplate;
    }

    /**
     * Listener factory for the payroll queues: a failing delivery is retried a
     * bounded number of times and the poison message is then republished to
     * the payroll DLQ with full context (original payload plus diagnostic
     * headers). Messages are never requeued indefinitely, so a broker cannot
     * churn on an unprocessable event.
     */
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            @Value("${payroll.listener.max-attempts:3}") int maxAttempts,
            ConnectionFactory connectionFactory,
            RabbitTemplate rabbitTemplate) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());
        factory.setDefaultRequeueRejected(false);
        factory.setAdviceChain(RetryInterceptorBuilder.stateless()
                .maxAttempts(maxAttempts)
                .backOffOptions(1000, 2.0, 30000)
                .recoverer(new RepublishMessageRecoverer(rabbitTemplate, exchangeName, DLQ_ROUTING_KEY))
                .build());
        return factory;
    }
}
