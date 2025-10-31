#!/bin/bash

# Direct test of AI agent search functionality
# This calls the EXACT same code the AI uses

echo "=========================================="
echo "Testing AI Agent Search Directly"
echo "=========================================="
echo ""

# Test 1: Check if test endpoint exists
echo "Test 1: Testing search endpoint..."
curl -s "http://localhost:3000/api/test-search-users?query=Gia%20Khang" | jq '.'

echo ""
echo "=========================================="
echo ""

# Test 2: Test with different queries
echo "Test 2: Testing variations..."
echo ""
echo "Query: 'Gia'"
curl -s "http://localhost:3000/api/test-search-users?query=Gia" | jq '.found, .results[].name'

echo ""
echo "Query: 'Khang'"
curl -s "http://localhost:3000/api/test-search-users?query=Khang" | jq '.found, .results[].name'

echo ""
echo "Query: 'Gia Khang Pham'"
curl -s "http://localhost:3000/api/test-search-users?query=Gia%20Khang%20Pham" | jq '.found, .results[].name'

echo ""
echo "=========================================="
echo "INSTRUCTIONS:"
echo "1. Make sure your dev server is running: npm run dev"
echo "2. Check the 'found' number above"
echo "3. If found = 0, the issue is in the search code"
echo "4. If found > 0, the issue is with AI not calling the tool"
echo "=========================================="

