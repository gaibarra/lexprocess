# Makefile para automatizar tareas de backend (Django) y frontend (React)
# Uso: make <target>
# Personaliza variables si tu entorno difiere

# === Variables Configurables ===
PYTHON ?= python3
VENV ?= venv
PIP ?= $(VENV)/bin/pip
PY ?= $(VENV)/bin/python
MANAGE ?= $(PY) lexprocess_backend/manage.py
BACKEND_DIR := lexprocess_backend
FRONTEND_DIR := lexprocess-frontend
FRONTEND_ENV_FILE := $(FRONTEND_DIR)/.env
REACT_API_BASE ?= http://localhost:8000/api/v1
CELERY_APP ?= lexprocess_backend

# Detecta si el venv existe
VENVDIR_EXISTS := $(wildcard $(VENV)/bin/activate)

# Colores
GREEN=\033[0;32m
BLUE=\033[0;34m
YELLOW=\033[1;33m
NC=\033[0m

.PHONY: help setup venv backend-install frontend-install install upgrade deps freeze env frontend-env migrate makemigrations superuser runserver frontend dev all test backend-test frontend-test coverage backend-coverage frontend-coverage lint format shell celery worker beat stopcelery build build-frontend build-backend clean clean-py clean-node resetdb data demo personal-despachos

help:
	@echo "${BLUE}Targets principales:${NC}"
	@echo "  make setup            -> Crear venv + instalar dependencias backend + frontend"
	@echo "  make dev              -> Backend (runserver) + Frontend (npm start) (2 terminales manualmente)"
	@echo "  make runserver        -> Ejecutar Django en modo desarrollo"
	@echo "  make frontend         -> Ejecutar React dev server"
	@echo "  make test             -> Tests backend + frontend"
	@echo "  make backend-test     -> Tests Django (pytest)"
	@echo "  make frontend-test    -> Tests React (Jest)"
	@echo "  make coverage         -> Cobertura backend + frontend"
	@echo "  make migrate          -> Aplicar migraciones"
	@echo "  make makemigrations   -> Crear nuevas migraciones (usa APP=mi_app)"
	@echo "  make superuser        -> Crear superusuario"
	@echo "  make celery           -> Iniciar worker Celery"
	@echo "  make build            -> Compilar frontend (production build)"
	@echo "  make clean            -> Limpiar artefactos temporales"
	@echo "  make env              -> Mostrar variables útiles"

setup: venv backend-install frontend-install frontend-env
	@echo "${GREEN}Setup completo.${NC}"

venv:
ifeq (,$(VENVDIR_EXISTS))
	$(PYTHON) -m venv $(VENV)
	@echo "${GREEN}Virtualenv creado en $(VENV).${NC}"
else
	@echo "${YELLOW}Virtualenv ya existe, omitiendo.${NC}"
endif

backend-install: venv
	$(PIP) install --upgrade pip
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt || $(PIP) install -r requirements.txt

frontend-install:
	cd $(FRONTEND_DIR) && npm install

install: setup

upgrade:
	$(PIP) install --upgrade -r $(BACKEND_DIR)/requirements.txt || $(PIP) install --upgrade -r requirements.txt

freeze:
	$(PIP) freeze > requirements.lock.txt

frontend-env:
	@if [ ! -f $(FRONTEND_ENV_FILE) ]; then \
		echo "REACT_APP_API_BASE_URL=$(REACT_API_BASE)" > $(FRONTEND_ENV_FILE); \
		echo "${GREEN}Archivo .env creado en $(FRONTEND_ENV_FILE).${NC}"; \
	else \
		echo "${YELLOW}$(FRONTEND_ENV_FILE) ya existe, no se modifica.${NC}"; \
	fi

migrate:
	$(MANAGE) migrate

makemigrations:
	@if [ -z "$(APP)" ]; then echo "Debe especificar APP=<nombre_app>" && exit 1; fi
	$(MANAGE) makemigrations $(APP)

superuser:
	$(MANAGE) createsuperuser

runserver:
	$(MANAGE) runserver

frontend:
	cd $(FRONTEND_DIR) && npm start

# Alias para desarrollo (debes abrir dos terminales: una 'make runserver' y otra 'make frontend')
dev: runserver
	@echo "${YELLOW}Abrir otra terminal y ejecutar: make frontend${NC}"

shell:
	$(MANAGE) shell

celery: worker

worker:
	$(VENV)/bin/celery -A $(CELERY_APP) worker -l info

beat:
	$(VENV)/bin/celery -A $(CELERY_APP) beat -l info

backend-test:
	pytest -q

frontend-test:
	cd $(FRONTEND_DIR) && npm test -- --watchAll=false

test: backend-test frontend-test

backend-coverage:
	pytest --cov=. --cov-report=term-missing

frontend-coverage:
	cd $(FRONTEND_DIR) && npm test -- --coverage --watchAll=false

coverage: backend-coverage frontend-coverage

lint:
	flake8 $(BACKEND_DIR) || true
	cd $(FRONTEND_DIR) && npx eslint src || true

format:
	black $(BACKEND_DIR) || true
	cd $(FRONTEND_DIR) && npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}" || true

build-backend:
	@echo "(No build específico backend, solo migraciones)"

build-frontend:
	cd $(FRONTEND_DIR) && npm run build

build: build-frontend

clean-py:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -exec rm -rf {} +

clean-node:
	rm -rf $(FRONTEND_DIR)/node_modules/.cache 2>/dev/null || true

clean: clean-py clean-node
	@echo "${GREEN}Limpieza completada.${NC}"

resetdb:
	$(MANAGE) flush --noinput
	$(MANAGE) migrate

env:
	@echo "Python: $(PYTHON)"
	@echo "Virtualenv: $(VENV)"; [ -d $(VENV) ] && echo "(existe)" || echo "(no existe)"
	@echo "Django settings: $$DJANGO_SETTINGS_MODULE"
	@echo "React API base: $(REACT_API_BASE)"

# Carga de datos de ejemplo (puedes implementar un fixture y referenciarlo aquí)
# make demo FIXTURE=demo_data.json

demo:
	@if [ -z "$(FIXTURE)" ]; then echo "Especifica FIXTURE=<archivo.json>" && exit 1; fi
	$(MANAGE) loaddata $(FIXTURE)

personal-despachos:
	$(MANAGE) create_personal_despachos
