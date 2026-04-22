FROM maven:3.9-amazoncorretto-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM amazoncorretto:17-alpine
WORKDIR /app
COPY --from=builder /app/target/payroll-service-*.jar app.jar
EXPOSE 8002
ENTRYPOINT ["java", "-jar", "app.jar"]
