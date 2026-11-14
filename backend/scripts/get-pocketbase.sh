#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
VERSION_FILE="$BACKEND_DIR/POCKETBASE_VERSION"

if [ ! -f "$VERSION_FILE" ]; then
  echo "Error: $VERSION_FILE not found." >&2
  exit 1
fi

PB_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64|amd64)
    PB_ARCH="amd64"
    ;;
  aarch64|arm64)
    PB_ARCH="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

TARGET_BIN="$BACKEND_DIR/pocketbase"
if [ -x "$TARGET_BIN" ]; then
  CURRENT_VERSION="$("$TARGET_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")"
  if [ "$CURRENT_VERSION" = "$PB_VERSION" ]; then
    echo "PocketBase v$PB_VERSION is already downloaded at $TARGET_BIN"
    exit 0
  fi
fi

DOWNLOAD_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading PocketBase v${PB_VERSION} for linux_${PB_ARCH}..."
curl -sSL "$DOWNLOAD_URL" -o "$TMP_DIR/pb.zip"

echo "Extracting to $BACKEND_DIR..."
unzip -q -o "$TMP_DIR/pb.zip" pocketbase -d "$BACKEND_DIR"
chmod +x "$TARGET_BIN"

echo "PocketBase v${PB_VERSION} ready at $TARGET_BIN"
"$TARGET_BIN" --version
