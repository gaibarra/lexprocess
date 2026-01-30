#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/gaibarra/lexprocess"
FRONTEND_DIR="$ROOT_DIR/lexprocess-frontend"
BACKEND_DIR="$ROOT_DIR/lexprocess_backend"
VENV_DIR="$BACKEND_DIR/venv"
FRONTEND_TARGET_DIR="/srv/lexprocess/lexprocess-frontend/build"

# --- Frontend build + deploy ---
cd "$FRONTEND_DIR"
PUBLIC_URL=/assets npm run build
rsync -av --delete "$FRONTEND_DIR/build/" "$FRONTEND_TARGET_DIR/"

# --- Backend migrate + collectstatic ---
cd "$BACKEND_DIR"
if [[ -f "$VENV_DIR/bin/activate" ]]; then
  source "$VENV_DIR/bin/activate"
fi

PYTHON_BIN=""
if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_BIN="$VENV_DIR/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "Python not found. Ensure venv exists or install python3."
  exit 1
fi

"$PYTHON_BIN" manage.py migrate
"$PYTHON_BIN" manage.py collectstatic --noinput

# --- Restart services ---
sudo systemctl restart gunicorn-lexprocess
sudo systemctl restart supervisor
if sudo supervisorctl status >/dev/null 2>&1; then
  sudo supervisorctl reread
  sudo supervisorctl update
  sudo supervisorctl restart celery
else
  echo "Warning: supervisorctl unavailable; skipped celery restart."
fi
sudo systemctl reload nginx

echo "Full deploy completed."
