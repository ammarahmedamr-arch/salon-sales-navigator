#!/usr/bin/env bash
# ==============================================================================
# OJLinker CRM — Deployment & Update Script
#
# Usage:
#   ./deploy/deploy.sh [branch_or_tag]
# Example:
#   ./deploy/deploy.sh phase-1
#   ./deploy/deploy.sh main
# ==============================================================================

set -euo pipefail

TARGET_REF="${1:-phase-1}"
APP_DIR="/var/www/ojlinker-crm"

echo "=========================================================="
echo " Starting OJLinker CRM Deployment (Ref: ${TARGET_REF})"
echo " Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================================="

cd "${APP_DIR}"

# 1. Fetch latest changes and checkout
echo "==> Fetching git updates..."
git fetch origin
git checkout "${TARGET_REF}"
git pull origin "${TARGET_REF}"

# 2. Ensure PocketBase binary is installed
if [ ! -f "${APP_DIR}/backend/pocketbase" ]; then
    echo "==> Downloading PocketBase binary..."
    bash "${APP_DIR}/backend/scripts/get-pocketbase.sh"
fi

# 3. Install frontend dependencies
echo "==> Installing Node dependencies..."
npm ci --prefer-offline

# 4. Build production frontend SPA
echo "==> Building production frontend..."
npm run build

# 5. Apply PocketBase migrations
echo "==> Running PocketBase database migrations..."
./backend/pocketbase migrate up --dir="${APP_DIR}/backend/pb_data"

# 6. Restart PocketBase systemd service
if systemctl is-active --quiet pocketbase 2>/dev/null; then
    echo "==> Restarting PocketBase systemd service..."
    sudo systemctl restart pocketbase
else
    echo "==> PocketBase systemd service not active, skipping restart."
    echo "    (To enable: sudo systemctl enable --now pocketbase)"
fi

# 7. Reload Caddy web server
if systemctl is-active --quiet caddy 2>/dev/null; then
    echo "==> Reloading Caddy web server..."
    sudo systemctl reload caddy
else
    echo "==> Caddy service not active, skipping reload."
fi

echo "=========================================================="
echo " OJLinker CRM deployed successfully!"
echo "=========================================================="
