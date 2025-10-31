#!/bin/bash

# Clerva Security Checklist Script
# Run this before any production deployment

set -e

echo "=================================="
echo "🔒 CLERVA SECURITY CHECKLIST"
echo "=================================="
echo ""

ERRORS=0

# 1. Check for hardcoded secrets in code
echo "1️⃣  Checking for hardcoded secrets..."
if grep -r "sk-" src/ --include="*.ts" --include="*.tsx" -q 2>/dev/null; then
  echo "   ❌ Found potential hardcoded OpenAI key"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No hardcoded OpenAI keys found"
fi

if grep -r "eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*" src/ --include="*.ts" --include="*.tsx" -q 2>/dev/null; then
  echo "   ⚠️  Found potential JWT tokens in code"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No hardcoded JWT tokens found"
fi

# 2. Check .env not tracked in git
echo ""
echo "2️⃣  Checking .env files are not tracked..."
if git ls-files 2>/dev/null | grep -q "\.env$"; then
  echo "   ❌ .env file is tracked in git!"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ .env files are not tracked"
fi

# 3. Verify .gitignore includes .env
echo ""
echo "3️⃣  Checking .gitignore configuration..."
if grep -q "^\.env" .gitignore 2>/dev/null; then
  echo "   ✅ .gitignore includes .env files"
else
  echo "   ❌ .gitignore missing .env patterns"
  ERRORS=$((ERRORS + 1))
fi

# 4. Check for service role key in client code
echo ""
echo "4️⃣  Checking for service role key in client code..."
if grep -r "SUPABASE_SERVICE_ROLE_KEY" src/components/ src/app --include="*.tsx" -q 2>/dev/null; then
  echo "   ❌ Service role key found in client code!"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ Service role key not in client code"
fi

# 5. Run npm audit
echo ""
echo "5️⃣  Running npm audit..."
AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1 || true)
if echo "$AUDIT_OUTPUT" | grep -q "found.*high.*vulnerability\|found.*critical.*vulnerability"; then
  echo "   ❌ High/Critical vulnerabilities found"
  echo "$AUDIT_OUTPUT" | grep "high\|critical" | head -5
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No high/critical vulnerabilities"
fi

# 6. Check if tsx is installed (needed for RLS tests)
echo ""
echo "6️⃣  Checking dependencies..."
if command -v tsx >/dev/null 2>&1 || npm list tsx >/dev/null 2>&1; then
  echo "   ✅ tsx is available"
else
  echo "   ⚠️  tsx not installed (needed for RLS tests)"
  echo "      Run: npm install -D tsx"
fi

# 7. Check for required environment variables
echo ""
echo "7️⃣  Checking environment variables..."
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "DATABASE_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^$var=" .env 2>/dev/null; then
    echo "   ✅ $var is set"
  else
    echo "   ⚠️  $var not found in .env"
  fi
done

# 8. Check for test files
echo ""
echo "8️⃣  Checking for test files..."
if [ -f "scripts/test-rls.ts" ]; then
  echo "   ✅ RLS test script exists"
else
  echo "   ⚠️  RLS test script not found"
fi

# 9. Summary
echo ""
echo "=================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
  echo "=================================="
  exit 0
else
  echo "❌ FOUND $ERRORS SECURITY ISSUE(S)"
  echo "=================================="
  echo ""
  echo "Please fix the issues above before deploying to production."
  exit 1
fi

