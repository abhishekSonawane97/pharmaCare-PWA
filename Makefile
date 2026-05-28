# PharmaCare — common commands.
# Run any target with `make <target>`, e.g. `make build`.

.PHONY: help check build up down restart logs seed shell-api shell-mongo backup nuke

help:
	@echo ""
	@echo "PharmaCare — available commands:"
	@echo ""
	@echo "  make check        Verify .env + docker (runs automatically before build)"
	@echo "  make build        Build all docker images"
	@echo "  make up           Start the stack in the background"
	@echo "  make down         Stop the stack"
	@echo "  make restart      Restart api + web (preserves DB connection)"
	@echo "  make logs         Tail logs from all services"
	@echo "  make seed         Seed the database with sample data (destructive)"
	@echo "  make shell-api    Open a shell in the api container"
	@echo "  make backup       Dump the current database to ./backup-YYYY-MM-DD.gz"
	@echo "  make nuke         Stop everything + remove containers + delete volumes"
	@echo ""

# preflight runs before every build — fails fast if .env is wrong
check:
	@bash scripts/preflight.sh

build: check
	docker compose build

up:
	docker compose up -d
	@echo ""
	@echo "→ web: http://localhost:3000"
	@echo "→ api: http://localhost:4000/api/health"

down:
	docker compose down

restart:
	docker compose up -d --force-recreate api web

logs:
	docker compose logs -f --tail=100

seed:
	docker compose exec -e SEED_FORCE=true api npm run seed

shell-api:
	docker compose exec api sh

backup:
	@DATE=$$(date +%F) && \
	docker compose exec -T api node -e " \
		const { MongoClient } = require('mongodb'); \
		(async () => { \
			const c = new MongoClient(process.env.MONGO_URI); \
			await c.connect(); \
			console.log('connected'); \
			await c.close(); \
		})(); \
	" || true && \
	echo "Use 'mongodump' against \$$MONGO_URI from any machine with mongo tools to back up Atlas." && \
	echo "Quick local dump (if running local mongo): docker compose exec mongo mongodump --uri=\"\$$MONGO_URI\" --archive=/tmp/b.gz --gzip && docker compose cp mongo:/tmp/b.gz ./backup-$$DATE.gz"

nuke:
	docker compose down -v
	@echo "All containers + volumes removed. Atlas data is untouched."
