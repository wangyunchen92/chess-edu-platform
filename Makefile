dev-up:
	docker-compose up -d

dev-down:
	docker-compose down

backend-dev:
	cd backend && uvicorn app.main:app --reload --port 8000

frontend-dev:
	cd frontend && npm run dev

db-migrate:
	cd backend && alembic upgrade head

db-rollback:
	cd backend && alembic downgrade -1

test-backend:
	cd backend && pytest -v

test-all: test-backend
