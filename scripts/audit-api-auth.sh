#!/bin/bash

# ==========================================
# API ENDPOINT AUTHENTICATION AUDIT SCRIPT
# ==========================================
# Purpose: Check all API endpoints for proper authentication
# Outputs: Detailed report of endpoints with/without auth checks
# ==========================================

API_DIR="/Users/minhpham/Documents/minh project.html/clerva-app/src/app/api"
OUTPUT_FILE="/Users/minhpham/Documents/minh project.html/clerva-app/docs/API_AUTH_AUDIT_REPORT.md"

echo "# 🔒 API Authentication Audit Report" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**Generated:** $(date)" >> "$OUTPUT_FILE"
echo "**Total Endpoints:** $(find "$API_DIR" -name "route.ts" | wc -l)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Arrays to store results
declare -a SECURE_ENDPOINTS
declare -a INSECURE_ENDPOINTS
declare -a PUBLIC_ENDPOINTS
declare -a DEBUG_ENDPOINTS

# Find all route.ts files
while IFS= read -r file; do
    # Get relative path
    rel_path="${file#$API_DIR/}"

    # Check if file contains auth check
    has_auth=$(grep -c "supabase.auth.getUser()" "$file" || echo 0)
    has_createClient=$(grep -c "createClient()" "$file" || echo 0)
    has_unauthorized=$(grep -c "Unauthorized" "$file" || echo 0)

    # Check if it's a public endpoint (auth, health, etc.)
    if [[ "$rel_path" == *"auth/"* ]] || [[ "$rel_path" == *"health/"* ]]; then
        PUBLIC_ENDPOINTS+=("$rel_path")
    # Check if it's a debug endpoint
    elif [[ "$rel_path" == *"debug"* ]] || [[ "$rel_path" == *"test"* ]] || [[ "$rel_path" == *"list-all-users"* ]]; then
        DEBUG_ENDPOINTS+=("$rel_path")
    # Check if it has auth
    elif [ "$has_auth" -gt 0 ] && [ "$has_unauthorized" -gt 0 ]; then
        SECURE_ENDPOINTS+=("$rel_path")
    else
        INSECURE_ENDPOINTS+=("$rel_path")
    fi
done < <(find "$API_DIR" -name "route.ts" -type f)

# Write summary
echo "## 📊 Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Category | Count | Status |" >> "$OUTPUT_FILE"
echo "|----------|-------|--------|" >> "$OUTPUT_FILE"
echo "| ✅ Secure Endpoints | ${#SECURE_ENDPOINTS[@]} | Has auth checks |" >> "$OUTPUT_FILE"
echo "| ⚠️ Potentially Insecure | ${#INSECURE_ENDPOINTS[@]} | **Needs Review** |" >> "$OUTPUT_FILE"
echo "| 🌐 Public Endpoints | ${#PUBLIC_ENDPOINTS[@]} | Intentionally public |" >> "$OUTPUT_FILE"
echo "| 🐛 Debug Endpoints | ${#DEBUG_ENDPOINTS[@]} | **Must be removed/protected** |" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Write secure endpoints
echo "## ✅ Secure Endpoints (${#SECURE_ENDPOINTS[@]})" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "These endpoints have proper authentication checks:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for endpoint in "${SECURE_ENDPOINTS[@]}"; do
    echo "- \`$endpoint\`" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Write insecure endpoints
echo "## ⚠️ Potentially Insecure Endpoints (${#INSECURE_ENDPOINTS[@]})" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**⚠️ ACTION REQUIRED:** These endpoints may be missing authentication:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for endpoint in "${INSECURE_ENDPOINTS[@]}"; do
    echo "- \`$endpoint\` - **NEEDS MANUAL REVIEW**" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Write public endpoints
echo "## 🌐 Public Endpoints (${#PUBLIC_ENDPOINTS[@]})" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "These endpoints are intentionally public (auth, health checks, etc.):" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for endpoint in "${PUBLIC_ENDPOINTS[@]}"; do
    echo "- \`$endpoint\`" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Write debug endpoints
echo "## 🐛 Debug/Test Endpoints (${#DEBUG_ENDPOINTS[@]})" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**🚨 CRITICAL:** These debug endpoints MUST be removed or protected before production:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
for endpoint in "${DEBUG_ENDPOINTS[@]}"; do
    echo "- \`$endpoint\` - **DELETE OR PROTECT**" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Write recommendations
echo "## 📋 Recommendations" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Immediate Actions:" >> "$OUTPUT_FILE"
echo "1. **Review all Insecure Endpoints** - Add \`auth.getUser()\` check at the start" >> "$OUTPUT_FILE"
echo "2. **Remove/Protect Debug Endpoints** - Delete or add production checks" >> "$OUTPUT_FILE"
echo "3. **Test Authorization** - Verify users can't access other users' data" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Standard Auth Pattern:" >> "$OUTPUT_FILE"
echo "\`\`\`typescript" >> "$OUTPUT_FILE"
echo "export async function POST(request: NextRequest) {" >> "$OUTPUT_FILE"
echo "  try {" >> "$OUTPUT_FILE"
echo "    // 1. Verify authentication" >> "$OUTPUT_FILE"
echo "    const supabase = await createClient()" >> "$OUTPUT_FILE"
echo "    const { data: { user }, error: authError } = await supabase.auth.getUser()" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "    if (authError || !user) {" >> "$OUTPUT_FILE"
echo "      return NextResponse.json(" >> "$OUTPUT_FILE"
echo "        { error: 'Unauthorized' }," >> "$OUTPUT_FILE"
echo "        { status: 401 }" >> "$OUTPUT_FILE"
echo "      )" >> "$OUTPUT_FILE"
echo "    }" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "    // 2. Your logic here..." >> "$OUTPUT_FILE"
echo "    " >> "$OUTPUT_FILE"
echo "    // 3. Always filter by user.id to prevent data leakage" >> "$OUTPUT_FILE"
echo "    const data = await prisma.model.findMany({" >> "$OUTPUT_FILE"
echo "      where: { userId: user.id } // ← Critical!" >> "$OUTPUT_FILE"
echo "    })" >> "$OUTPUT_FILE"
echo "    " >> "$OUTPUT_FILE"
echo "    return NextResponse.json({ data })" >> "$OUTPUT_FILE"
echo "  } catch (error) {" >> "$OUTPUT_FILE"
echo "    return NextResponse.json(" >> "$OUTPUT_FILE"
echo "      { error: 'Internal server error' }," >> "$OUTPUT_FILE"
echo "      { status: 500 }" >> "$OUTPUT_FILE"
echo "    )" >> "$OUTPUT_FILE"
echo "  }" >> "$OUTPUT_FILE"
echo "}" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "**Audit completed. Review the report and take action on insecure and debug endpoints.**" >> "$OUTPUT_FILE"

echo "✅ Audit complete! Report saved to: $OUTPUT_FILE"
echo "📊 Summary:"
echo "  - Secure: ${#SECURE_ENDPOINTS[@]}"
echo "  - Insecure: ${#INSECURE_ENDPOINTS[@]}"
echo "  - Public: ${#PUBLIC_ENDPOINTS[@]}"
echo "  - Debug: ${#DEBUG_ENDPOINTS[@]}"
