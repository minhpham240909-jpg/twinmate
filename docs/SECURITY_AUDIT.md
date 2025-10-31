# Security Audit Guide

## How to Run Security Audit

This guide helps you verify that no secrets are exposed and all security measures are in place.

## 1. Check Git History for Secrets

### Scan for accidentally committed secrets

```bash
# Check if .env files were ever committed
git log --all --full-history -- '**/.env'
git log --all --full-history -- '**/.env.local'
git log --all --full-history -- '**/.env.production'

# Search for common secret patterns
git log --all --full-history -p | grep -i "password" | head -20
git log --all --full-history -p | grep -i "secret" | head -20
git log --all --full-history -p | grep -i "api.key" | head -20
git log --all --full-history -p | grep -E "sk-[a-zA-Z0-9]{48}" | head -10  # OpenAI keys
git log --all --full-history -p | grep -E "eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*" | head -10  # JWT tokens
```

### If secrets found in git history

**CRITICAL: If you find exposed secrets**

1. **Rotate immediately:**
   - Supabase: Project Settings > API > Reset keys
   - Google OAuth: Delete and create new credentials
   - Agora: Reset certificate in console
   - Stripe: Revoke and create new keys
   - OpenAI: Revoke key in dashboard
   - Sentry: Rotate auth token

2. **Remove from git history** (use with caution):

```bash
# Option 1: Using git-filter-repo (recommended)
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git filter-repo --replace-text <(echo "OLD_SECRET==>REMOVED")

# Option 2: Using BFG Repo-Cleaner
brew install bfg
bfg --delete-files .env
bfg --replace-text secrets.txt  # List of secrets to remove
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Force push (coordinate with team first!)
git push origin --force --all
```

3. **Verify removal:**
```bash
git log --all --full-history -p | grep "the-secret-you-removed"
```

## 2. Verify .gitignore

### Check .gitignore includes all secret files

```bash
cat .gitignore | grep -E "\.env|secrets|credentials"
```

Should include:
```
.env*
.env.local
.env.production
.env.development
```

### Test .gitignore is working

```bash
# This should NOT list any .env files
git ls-files | grep "\.env"

# If it shows .env files, they're tracked! Untrack them:
git rm --cached .env .env.local .env.production
git commit -m "Remove tracked .env files"
```

## 3. Verify Environment Variables

### Check all required vars are documented

```bash
# Compare .env.example with actual variables used in code
grep -r "process\.env\." src/ --include="*.ts" --include="*.tsx" | \
  sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' | \
  sort -u > /tmp/used-vars.txt

grep "^[A-Z_]*=" .env.example | \
  cut -d'=' -f1 | \
  sort > /tmp/documented-vars.txt

# Find undocumented variables
comm -23 /tmp/used-vars.txt /tmp/documented-vars.txt
```

### Check for hardcoded secrets in code

```bash
# Search for potential hardcoded secrets
grep -r "sk-" src/ --include="*.ts" --include="*.tsx"
grep -r "secret.*=" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env"
grep -r "password.*=" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env"
grep -r "api_key.*=" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env"
```

## 4. Dependency Security Audit

### Run npm audit

```bash
# Check for vulnerabilities
npm audit

# Show only critical and high severity
npm audit --audit-level=high

# Fix automatically fixable issues
npm audit fix

# For issues requiring breaking changes (use with caution)
npm audit fix --force
```

### Check for outdated packages

```bash
# List outdated packages
npm outdated

# Update specific package
npm update <package-name>

# Update to latest (breaking changes possible)
npm install <package-name>@latest
```

### Regular security maintenance

```bash
# Add to your weekly routine
npm audit
npm outdated | grep -E "Major|wanted"
```

## 5. Check Supabase Security

### RLS Status

```bash
# Run RLS tests
npm run test:rls

# Or directly
npx tsx scripts/test-rls.ts
```

### Service Role Key Security

```bash
# NEVER in client-side code
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/components/ src/app/ --include="*.tsx"

# Should only be in:
# - src/lib/supabase/server.ts
# - src/app/api/**/*.ts (server-side API routes)
```

### Check for exposed keys in browser

1. Open your app in browser
2. Open DevTools > Network
3. Check API calls - should NOT see service_role in headers
4. Open Console and type: `process.env` - should be undefined in browser

## 6. API Security Checklist

### Rate Limiting

```bash
# Verify rate limiting is applied
grep -r "rateLimit" src/app/api/ --include="*.ts"
```

Should be on:
- `/api/auth/signin`
- `/api/auth/signup`
- `/api/auth/google`
- Any public endpoints

### Authentication Checks

```bash
# Find API routes without auth checks
for file in $(find src/app/api -name "route.ts"); do
  if ! grep -q "auth\|getUser\|session" "$file"; then
    echo "⚠️  No auth check in: $file"
  fi
done
```

### Input Validation

```bash
# Check for Zod validation
grep -r "z\\.object\\|schema\\.parse" src/app/api/ --include="*.ts" -c
```

## 7. Third-Party Service Security

### Supabase
- [ ] RLS enabled on all tables
- [ ] Service role key not in client code
- [ ] Database backups enabled
- [ ] 2FA enabled on Supabase account

### Google OAuth
- [ ] Authorized redirect URIs whitelist only your domains
- [ ] Client secret not in client code
- [ ] OAuth consent screen configured

### Agora
- [ ] App certificate enabled
- [ ] Token authentication required
- [ ] Certificate not exposed to client

### Stripe (if using)
- [ ] Webhook signature verification implemented
- [ ] Secret key server-side only
- [ ] Test mode for development

### Sentry
- [ ] Auth token not in client code
- [ ] Source maps uploaded securely
- [ ] PII scrubbing configured

### OpenAI
- [ ] API key server-side only
- [ ] Usage limits set
- [ ] Billing alerts configured

## 8. Production Deployment Security

### Before deploying

- [ ] All tests passing
- [ ] No secrets in code or git history
- [ ] .env.example up to date
- [ ] RLS tests passing
- [ ] npm audit shows no critical issues
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled

### Production environment

- [ ] Separate keys for production (never use dev keys)
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Monitoring and alerts set up

### Access control

- [ ] Limit who has access to production keys
- [ ] Use secret management system (Supabase Vault, Google Secret Manager)
- [ ] Document key rotation procedure
- [ ] Enable 2FA on all service accounts

## 9. Incident Response Plan

### If a secret is exposed

1. **Immediate (within 5 minutes):**
   - Rotate the exposed secret
   - Check logs for unauthorized access
   - Revoke active sessions if auth keys exposed

2. **Short-term (within 1 hour):**
   - Remove secret from git history
   - Deploy new keys to production
   - Notify team
   - Check for data breaches

3. **Follow-up (within 24 hours):**
   - Review how it was exposed
   - Update procedures to prevent recurrence
   - Document incident
   - Consider security audit

### Contact information

Keep these handy for emergencies:
- Supabase Support: support@supabase.com
- Google Cloud Support: (your support tier)
- Your team: (list key contacts)

## 10. Regular Security Schedule

### Daily (automated)
- Dependency vulnerability scans in CI
- RLS tests in CI pipeline

### Weekly (manual)
- Review `npm audit` output
- Check Sentry for auth errors
- Review Supabase logs

### Monthly (manual)
- Full security audit (this document)
- Review access logs
- Update dependencies
- Rotate development secrets

### Quarterly (manual)
- Rotate production secrets
- Security review meeting
- Update security documentation
- Penetration testing (if budget allows)

### Annually
- Full security audit by external party (if revenue supports)
- Review and update incident response plan
- Security training refresher

## Quick Security Checklist

Run this before any production deployment:

```bash
#!/bin/bash

echo "🔒 Running Security Checklist..."

# 1. Check for secrets in code
echo "Checking for hardcoded secrets..."
if grep -r "sk-" src/ --include="*.ts" --include="*.tsx" -q; then
  echo "❌ Found potential hardcoded OpenAI key"
  exit 1
fi

# 2. Check .env not tracked
if git ls-files | grep -q "\.env$"; then
  echo "❌ .env file is tracked in git!"
  exit 1
fi

# 3. Run npm audit
echo "Running npm audit..."
if npm audit --audit-level=high 2>&1 | grep -q "found.*vulnerability"; then
  echo "❌ High/Critical vulnerabilities found"
  exit 1
fi

# 4. Check RLS
echo "Testing RLS..."
if ! npm run test:rls > /dev/null 2>&1; then
  echo "❌ RLS tests failed"
  exit 1
fi

# 5. Verify .env.example is up to date
echo "Checking .env.example..."
if [ .env.example -ot src/ ]; then
  echo "⚠️  .env.example might be outdated"
fi

echo "✅ Security checklist passed!"
```

Save as `scripts/security-check.sh` and run before deploy.

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [npm Security Best Practices](https://docs.npmjs.com/cli/v8/using-npm/security)

