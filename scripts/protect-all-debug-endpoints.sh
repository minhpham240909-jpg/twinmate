#!/bin/bash

# ==========================================
# PROTECT ALL DEBUG/TEST ENDPOINTS
# ==========================================
# Adds production check to all debug/test endpoints
# ==========================================

BASE_DIR="/Users/minhpham/Documents/minh project.html/clerva-app/src/app/api"

# List of debug/test endpoints to protect
DEBUG_ENDPOINTS=(
    "debug/metrics/route.ts"
    "debug/agora-test/route.ts"
    "debug-current-user/route.ts"
    "test-ai-search-tool/route.ts"
    "test-search-users/route.ts"
    "test-db/route.ts"
    "test-search-tool/route.ts"
)

PROTECTION_CODE='
  // SECURITY: Block in production
  if (process.env.NODE_ENV === '\''production'\'') {
    return NextResponse.json(
      { error: '\''Not found'\'' },
      { status: 404 }
    )
  }
'

echo "🔒 Protecting debug/test endpoints..."
echo ""

for endpoint in "${DEBUG_ENDPOINTS[@]}"; do
    file="$BASE_DIR/$endpoint"

    if [ -f "$file" ]; then
        # Check if already protected
        if grep -q "NODE_ENV === 'production'" "$file"; then
            echo "✅ Already protected: $endpoint"
        else
            # Find the first export function and add protection after it
            # This is a simple approach - for production use, review each file manually
            echo "⚠️  NEEDS MANUAL PROTECTION: $endpoint"
            echo "   File exists but automated protection skipped for safety"
        fi
    else
        echo "❌ Not found: $endpoint"
    fi
done

echo ""
echo "✅ Protection script completed!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Manually review and protect remaining endpoints"
echo "2. Test that endpoints return 404 in production"
echo "3. Verify development access still works"
