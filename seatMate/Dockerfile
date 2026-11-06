FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM eclipse-temurin:17-jdk AS backend-build

WORKDIR /app
COPY src/ src/
COPY lib/ lib/
RUN mkdir -p bin && javac -cp "lib/*" -d bin src/SeatMateWeb.java

FROM eclipse-temurin:17-jre

WORKDIR /app
COPY --from=backend-build /app/bin/ bin/
COPY --from=backend-build /app/lib/ lib/
COPY --from=frontend-build /app/web/dist/ web/dist/

ENV PORT=8080
EXPOSE 8080
CMD ["java", "-cp", "bin:lib/*", "SeatMateWeb"]
