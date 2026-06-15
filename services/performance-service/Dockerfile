# Stage 1: Build Jar
FROM maven:3.9.16-amazoncorretto-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline || true
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal Runtime JRE
FROM amazoncorretto:17-alpine
WORKDIR /app
COPY --from=builder /app/target/performance-service-0.0.1-SNAPSHOT.jar performance-service.jar
EXPOSE 8014
ENTRYPOINT ["java", "-jar", "performance-service.jar"]
