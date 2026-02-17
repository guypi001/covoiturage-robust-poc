.PHONY: init-env up down logs

COMPOSE_PROFILES ?= proxy
WEBAPP_HOST ?= 82.112.255.155

init-env:
	./ops/init-env.sh

up:
	./ops/init-env.sh
	COMPOSE_PROFILES=$(COMPOSE_PROFILES) WEBAPP_HOST=$(WEBAPP_HOST) docker compose up --build --detach

down:
	COMPOSE_PROFILES=$(COMPOSE_PROFILES) WEBAPP_HOST=$(WEBAPP_HOST) docker compose down --remove-orphans

logs:
	COMPOSE_PROFILES=$(COMPOSE_PROFILES) WEBAPP_HOST=$(WEBAPP_HOST) docker compose logs -f
