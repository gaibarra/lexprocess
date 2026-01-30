#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/gaibarra/lexprocess"
FRONTEND_DIR="$ROOT_DIR/lexprocess-frontend"
TARGET_DIR="/srv/lexprocess/lexprocess-frontend/build"

cd "$FRONTEND_DIR"

PUBLIC_URL=/assets npm run build
rsync -av --delete "$FRONTEND_DIR/build/" "$TARGET_DIR/"
sudo systemctl reload nginx

echo "Frontend deploy completed."
