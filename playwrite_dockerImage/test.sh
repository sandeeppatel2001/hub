#!/bin/bash

# Complete cleanup and fresh test

echo "========================================="
echo "Complete System Test"
echo "========================================="

# 1. Clean up all session containers
echo "[1/7] Cleaning up old session containers..."
docker ps -a | grep session- | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
sleep 2

# 2. Rebuild session manager
echo "[2/7] Rebuilding session manager..."
docker compose build session-manager

# 3. Restart all services
echo "[3/7] Restarting services..."
docker compose down
docker compose up -d
sleep 5

# 4. Check health
echo "[4/7] Checking service health..."
curl -s http://localhost:3000/health | jq

# 5. Create test session
echo "[5/7] Creating test session..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/session/create \
  -H 'Content-Type: application/json' \
  -d '{"targetUrl": "https://example.com/", "userId": "complete-test"}')

echo "$RESPONSE" | jq

SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')
NOVNC_URL=$(echo "$RESPONSE" | jq -r '.novncUrl')

if [ "$SESSION_ID" == "null" ] || [ -z "$SESSION_ID" ]; then
    echo "❌ Session creation failed!"
    echo "Session manager logs:"
    docker logs session-manager --tail 20
    exit 1
fi

echo "✓ Session created: $SESSION_ID"

# 6. Wait for container to start
echo "[6/7] Waiting for container to start..."
sleep 10

# 7. Check network and test access
echo "[7/7] Testing access..."
echo "Container networks:"
docker inspect session-$SESSION_ID | jq '.[0].NetworkSettings.Networks | keys'

echo ""
echo "Testing noVNC URL: $NOVNC_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $NOVNC_URL)
echo "HTTP Response: $HTTP_CODE"

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ SUCCESS! noVNC is accessible"
    echo "Open this URL in your browser: $NOVNC_URL"
else
    echo "❌ FAILED! Got HTTP $HTTP_CODE"
    echo ""
    echo "Session manager logs:"
    docker logs session-manager | grep $SESSION_ID
    echo ""
    echo "Container logs:"
    docker logs session-$SESSION_ID --tail 20
fi

echo ""
echo "========================================="
