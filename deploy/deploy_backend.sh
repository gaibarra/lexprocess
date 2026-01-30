#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/gaibarra/lexprocess"
BACKEND_DIR="$ROOT_DIR/lexprocess_backend"
VENV_DIR="$ROOT_DIR/lexprocess_backend/venv"

cd "$BACKEND_DIR"

if [[ -f "$VENV_DIR/bin/activate" ]]; then
  source "$VENV_DIR/bin/activate"
fi

python manage.py migrate
python manage.py collectstatic --noinput

sudo systemctl restart gunicorn
sudo systemctl restart supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart celery

echo "Backend deploy completed."
