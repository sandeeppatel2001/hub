#!/bin/bash

# Build and Deploy Script for Browser Interceptor System

set -e

echo "========================================="
echo "Browser Interceptor - Build & Deploy"
echo "========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Build browser image
echo -e "\n${YELLOW}[1/4] Building browser container image...${NC}"
docker build -t browser-interceptor:latest -f dockerfile .
echo -e "${GREEN}✓ Browser image built${NC}"

# Step 2: Build session manager image
echo -e "\n${YELLOW}[2/4] Building session manager image...${NC}"
cd session-manager
docker build -t session-manager:latest .
cd ..
echo -e "${GREEN}✓ Session manager image built${NC}"

# Step 3: Stop existing containers
echo -e "\n${YELLOW}[3/4] Stopping existing containers...${NC}"
docker compose down 2>/dev/null || true
echo -e "${GREEN}✓ Cleaned up old containers${NC}"

# Step 4: Start services
echo -e "\n${YELLOW}[4/4] Starting services...${NC}"
docker compose up -d

# Wait for services to be ready
echo -e "\n${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Check health
echo -e "\n${YELLOW}Checking service health...${NC}"

# Check Redis
if docker exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${RED}✗ Redis is not responding${NC}"
fi

# Check MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MinIO is running${NC}"
else
    echo -e "${RED}✗ MinIO is not responding${NC}"
fi

# Check Session Manager
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Session Manager is running${NC}"
else
    echo -e "${RED}✗ Session Manager is not responding${NC}"
fi

# Check Nginx
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not responding${NC}"
fi

echo -e "\n========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Services:"
echo "  - Session Manager API: http://localhost:3000"
echo "  - MinIO Console:       http://localhost:9001"
echo "  - Nginx Proxy:         http://localhost"
echo ""
echo "Create a test session:"
echo "  curl -X POST http://localhost:3000/api/session/create \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"targetUrl\": \"https://example.com\"}'"
echo ""
echo "View logs:"
echo "  docker compose logs -f"
echo ""
echo "========================================="
