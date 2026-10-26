.PHONY: up down test lint

up:
	docker compose up --build -d

down:
	docker compose down

test:
	docker compose run --rm backend pytest tests

lint:
	docker compose run --rm frontend npm run lint
