#!/bin/bash
# Test script for cleanup endpoint
# Usage: ./scripts/test-cleanup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing Cleanup Endpoint${NC}\n"

# Check if required variables are set
if [ -z "$CLEANUP_API_KEY" ]; then
    echo -e "${RED}❌ Error: CLEANUP_API_KEY environment variable is not set${NC}"
    exit 1
fi

if [ -z "$APP_URL" ]; then
    echo -e "${YELLOW}⚠️  APP_URL not set, using default: http://localhost:3000${NC}"
    APP_URL="http://localhost:3000"
fi

ENDPOINT_URL="${APP_URL}/api/history/cleanup"

echo "Testing endpoint: ${ENDPOINT_URL}"
echo ""

# Test 1: Health check (GET)
echo -e "${GREEN}Test 1: Health Check (GET)${NC}"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${ENDPOINT_URL}")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi

echo ""

# Test 2: Cleanup endpoint (POST with auth)
echo -e "${GREEN}Test 2: Cleanup Endpoint (POST)${NC}"
CLEANUP_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${CLEANUP_API_KEY}" \
    -H "Content-Type: application/json" \
    "${ENDPOINT_URL}")

HTTP_CODE=$(echo "$CLEANUP_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$CLEANUP_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Cleanup endpoint accessible${NC}"
    echo "Response: $BODY"
    
    # Parse and display results
    MESSAGES=$(echo "$BODY" | grep -o '"messages":[0-9]*' | cut -d: -f2)
    GROUPS=$(echo "$BODY" | grep -o '"groups":[0-9]*' | cut -d: -f2)
    POSTS=$(echo "$BODY" | grep -o '"posts":[0-9]*' | cut -d: -f2)
    
    echo ""
    echo -e "${GREEN}📊 Cleanup Results:${NC}"
    echo "  Messages deleted: ${MESSAGES:-0}"
    echo "  Groups deleted: ${GROUPS:-0}"
    echo "  Posts deleted: ${POSTS:-0}"
else
    echo -e "${RED}❌ Cleanup failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
    
    if [ "$HTTP_CODE" = "401" ]; then
        echo -e "${YELLOW}💡 Tip: Check that CLEANUP_API_KEY matches the server's CLEANUP_API_KEY${NC}"
    fi
fi

echo ""

# Test 3: Unauthorized access (POST without auth)
echo -e "${GREEN}Test 3: Unauthorized Access Test${NC}"
UNAUTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    "${ENDPOINT_URL}")

HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Security check passed (correctly rejected unauthorized request)${NC}"
else
    echo -e "${RED}❌ Security check failed (should return 401, got $HTTP_CODE)${NC}"
fi

echo ""
echo -e "${GREEN}✨ Testing complete!${NC}"

