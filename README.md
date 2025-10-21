# Covoiturage CI — Robust PoC (NestJS + Redpanda + Postgres + Redis + Meilisearch + Prometheus/Grafana)

Microservices: **bff, identity, ride (outbox), search (idempotence + DLQ), booking (hold), payment (mock), wallet (holds), payouts (mock), notification, config**.

## Lancer
```bash
docker compose up -d --build
# Console Redpanda: http://localhost:8082
# Grafana: http://localhost:3007  (admin / admin)
# Prometheus: http://localhost:9090
```
