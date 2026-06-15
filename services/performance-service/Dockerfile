# Stage 1: Build Jar
FROM maven:3.9.16-amazoncorretto-17 AS builder
WORKDIR /app
COPY services/atlas-common/pom.xml services/atlas-common/pom.xml
COPY services/atlas-common/src services/atlas-common/src
RUN mvn install -f services/atlas-common/pom.xml -DskipTests
COPY services/performance-service/pom.xml services/performance-service/pom.xml
RUN mvn dependency:go-offline -f services/performance-service/pom.xml || true
COPY services/performance-service/src services/performance-service/src
RUN mvn clean package -f services/performance-service/pom.xml -DskipTests

# Stage 2: Minimal Runtime JRE
FROM amazoncorretto:17-alpine
WORKDIR /app
COPY --from=builder /app/services/performance-service/target/performance-service-0.0.1-SNAPSHOT.jar performance-service.jar
EXPOSE 8014
ENTRYPOINT ["java", "-jar", "performance-service.jar"]
