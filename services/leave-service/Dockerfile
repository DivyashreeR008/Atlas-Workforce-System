# Stage 1: Build Jar
FROM maven:3.9.16-amazoncorretto-17 AS builder
WORKDIR /app
COPY services/atlas-common/pom.xml services/atlas-common/pom.xml
COPY services/atlas-common/src services/atlas-common/src
RUN mvn install -f services/atlas-common/pom.xml -DskipTests
COPY services/leave-service/pom.xml services/leave-service/pom.xml
RUN mvn dependency:go-offline -f services/leave-service/pom.xml || true
COPY services/leave-service/src services/leave-service/src
RUN mvn clean package -f services/leave-service/pom.xml -DskipTests

# Stage 2: Minimal Runtime JRE
FROM amazoncorretto:17-alpine
WORKDIR /app
COPY --from=builder /app/services/leave-service/target/leave-service-0.0.1-SNAPSHOT.jar leave-service.jar
EXPOSE 8006
ENTRYPOINT ["java", "-jar", "leave-service.jar"]
