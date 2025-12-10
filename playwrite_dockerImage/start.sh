#!/bin/bash
set -e

SESSION_ID=${SESSION_ID:-"default"}
TARGET_URL=${TARGET_URL:-"https://www.google.com"}

echo "========================================="
echo "Starting Browser Session"
echo "========================================="
echo "Session ID: $SESSION_ID"
echo "Target URL: $TARGET_URL"
echo "========================================="

# Clean up any existing profile
rm -rf /tmp/chrome-profile-$SESSION_ID

echo "[1/6] Starting Xvfb display..."
Xvfb :99 -screen 0 1920x1080x16 &
export DISPLAY=:99
sleep 2

echo "[2/6] Starting window manager..."
fluxbox &
sleep 1

echo "[3/6] Starting VNC server..."
x11vnc -display :99 -rfbport 5900 -shared -forever -nopw &
sleep 1

echo "[4/6] Starting Chromium with target URL..."
chromium \
  --no-sandbox \
  --disable-gpu \
  --remote-debugging-port=9222 \
  --disable-dev-shm-usage \
  --user-data-dir=/tmp/chrome-profile-$SESSION_ID \
  --homepage="$TARGET_URL" \
  --start-maximized \
  --kiosk \
  "$TARGET_URL" &

sleep 3

echo "[5/6] Starting Playwright interceptor..."
node /app/playwright.js &

echo "[6/6] Starting noVNC server..."
echo "========================================="
echo "Browser ready! Session: $SESSION_ID"
echo "========================================="
/opt/noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 8080
 
