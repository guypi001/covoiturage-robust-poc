.PHONY: init-env up down logs email-health smtp-env

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

email-health:
	curl -sS "http://$(WEBAPP_HOST):3006/api/identity/health/email?verify=true"

smtp-env:
	COMPOSE_PROFILES=$(COMPOSE_PROFILES) WEBAPP_HOST=$(WEBAPP_HOST) docker compose exec identity sh -lc 'env | grep "^SMTP_"'
