# OJLinker CRM — VPS Deployment Guide

This guide describes how to deploy and operate the **OJLinker CRM** production stack on a Linux VPS (Ubuntu/Debian) running Caddy and PocketBase.

---

## Architecture Overview

```
                      HTTPS (:443)
User Browser ──────────────────────────────▶ Caddy Web Server
(RTL, Arabic, SPA)                                │
                                                   ├────────▶ Static SPA files (/var/www/ojlinker-crm/dist)
                                                   │
                                                   └────────▶ PocketBase (:8090)
                                                              (/api/* and /_*)
                                                                   │
                                                                   ▼
                                                               SQLite Database
                                                               (backend/pb_data/data.db)
```

- **Frontend:** React 19 + Vite SPA with TanStack Router, TanStack Query, Tailwind 4, shadcn/ui.
- **Backend:** PocketBase v0.22.57 (single binary, SQLite) listening on `127.0.0.1:8090`.
- **Reverse Proxy & SSL:** Caddy with automatic Let's Encrypt SSL certificates.

---

## 1. Prerequisites

Ensure the following packages are installed on the VPS:

```bash
# Update system
sudo apt update && sudo apt install -y curl wget unzip git sqlite3

# Install Node.js 20+ LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v      # v20.x or higher
npm -v       # 10.x or higher
sqlite3 -version
```

Install Caddy (official repo):
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

---

## 2. One-Time Setup

### Step 2.1 — Create System User & Directory

```bash
# Create dedicated system user
sudo useradd -r -s /bin/false -d /var/www/ojlinker-crm ojlinker || true

# Prepare directory
sudo mkdir -p /var/www/ojlinker-crm
sudo chown -R ojlinker:ojlinker /var/www/ojlinker-crm
```

### Step 2.2 — Clone the Repository

```bash
cd /var/www
# Clone the repository (or set up git credentials if private)
git clone https://github.com/ammarahmedamr-arch/salon-sales-navigator.git ojlinker-crm
cd /var/www/ojlinker-crm
git checkout phase-1
```

### Step 2.3 — Download PocketBase Binary & Run Migrations

```bash
# Run script to download the pinned PocketBase version (v0.22.57)
bash backend/scripts/get-pocketbase.sh

# Apply database migrations
./backend/pocketbase migrate up --dir=./backend/pb_data
```

### Step 2.4 — Create Admin User

Create the initial PocketBase superuser/admin account:

```bash
node backend/scripts/create-admin.mjs admin@ojlinker.sa "YourSecureAdminPassword123!"
```

### Step 2.5 — Build Frontend

```bash
npm ci --prefer-offline
npm run build
```

The static files will be placed in `/var/www/ojlinker-crm/dist`.

### Step 2.6 — Configure Permissions

```bash
sudo chown -R ojlinker:ojlinker /var/www/ojlinker-crm
sudo chmod -R 755 /var/www/ojlinker-crm/dist
sudo chmod 700 /var/www/ojlinker-crm/backend/pocketbase
sudo chmod -R 700 /var/www/ojlinker-crm/backend/pb_data
```

---

## 3. System Services Setup

### Step 3.1 — Install & Start PocketBase Systemd Service

```bash
# Copy systemd unit file
sudo cp deploy/pocketbase.service /etc/systemd/system/pocketbase.service

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase

# Check service status
sudo systemctl status pocketbase
```

### Step 3.2 — Configure & Reload Caddy

Edit `/etc/caddy/Caddyfile` or import the deployment Caddyfile:

```bash
# Backup existing Caddyfile if present
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup 2>/dev/null || true

# Copy template and customize your domain name
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/{\$DOMAIN:ojlinker.example.com}/crm.ojlinker.sa/g' /etc/caddy/Caddyfile

# Ensure log directory exists
sudo mkdir -p /var/log/caddy
sudo chown -R caddy:caddy /var/log/caddy

# Format and reload Caddy
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 4. Production Data Import (Excel)

To import the cold-calling salon list from the Excel tracker (`./data/OJLinker_Salon_Sales_Tracker.xlsx`):

```bash
cd /var/www/ojlinker-crm
node backend/scripts/import-excel.mjs ./data/OJLinker_Salon_Sales_Tracker.xlsx \
  --admin-email=admin@ojlinker.sa \
  --admin-password="YourSecureAdminPassword123!"
```

The script will:
1. Parse sheets `لوحة المتابعة`, `العملاء`, and `سجل التواصل`.
2. Normalize all Saudi phone numbers (`9665XXXXXXXX`).
3. Maintain auto-incrementing sequential codes (`SAL-XXXX` and `ACT-XXXXX`).
4. Link contact logs to salons atomically.

---

## 5. Ongoing Deployments

When new commits or tags are pushed, run the automated deployment script:

```bash
cd /var/www/ojlinker-crm
./deploy/deploy.sh phase-1
```

The script automatically:
1. Fetches and checks out the specified branch.
2. Installs Node dependencies (`npm ci`).
3. Builds the production frontend (`npm run build`).
4. Applies any pending PocketBase migrations.
5. Restarts the `pocketbase` systemd service.
6. Reloads `caddy`.

---

## 6. Backups & Disaster Recovery

### Automated Daily Backup

A safe SQLite online backup script is provided at `deploy/backup.sh`. It backs up `data.db` and uploaded attachments, compresses them to `/var/backups/ojlinker/`, and keeps the last 14 days of archives.

Set up a daily cron job (runs at 00:00 UTC / 03:00 Asia/Riyadh):

```bash
sudo crontab -e
```

Add the line:
```cron
0 0 * * * /var/www/ojlinker-crm/deploy/backup.sh >> /var/log/ojlinker-backup.log 2>&1
```

### Manual Backup

Run on demand at any time:
```bash
sudo /var/www/ojlinker-crm/deploy/backup.sh
```

### Disaster Recovery / Restore Procedure

To restore from a backup tarball:

```bash
# 1. Stop PocketBase
sudo systemctl stop pocketbase

# 2. Extract backup to a temporary directory
mkdir -p /tmp/restore
tar -xzf /var/backups/ojlinker/ojlinker_backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp/restore

# 3. Replace data.db and storage
sudo cp /tmp/restore/data.db /var/www/ojlinker-crm/backend/pb_data/data.db
if [ -d /tmp/restore/storage ]; then
    sudo cp -r /tmp/restore/storage /var/www/ojlinker-crm/backend/pb_data/
fi

# 4. Set ownership and restart service
sudo chown -R ojlinker:ojlinker /var/www/ojlinker-crm/backend/pb_data
sudo rm -rf /tmp/restore
sudo systemctl start pocketbase
```
