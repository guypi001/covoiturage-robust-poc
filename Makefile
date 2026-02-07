.PHONY: init-env up down logs

init-env:
	./ops/init-env.sh

up:
	./ops/init-env.sh
	docker compose up --build --detach

down:
	docker compose down --remove-orphans

logs:
	docker compose logs -f
