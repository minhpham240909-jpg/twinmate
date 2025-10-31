# QA Testing Guide - Clerva App

Comprehensive automated testing suite with Jest, Vitest, Playwright, and custom QA scripts.

## 🚀 Quick Start

```bash
# Run all tests
npm run qa:full

# Run unit tests (Jest)
npm test

# Run unit tests with Vitest (faster)
npm run test:vitest

# Run E2E tests (Playwright)
npm run test:e2e

# Run TypeScript checks
npm run typecheck

# Run security scan
npm run security

# Run performance tests
npm run performance
```

## 📋 Table of Contents

1. [Test Frameworks](#test-frameworks)
2. [Unit Testing](#unit-testing)
3. [E2E Testing](#e2e-testing)
4. [TypeScript Error Detection](#typescript-error-detection)
5. [Performance Monitoring](#performance-monitoring)
6. [Security Scanning](#security-scanning)
7. [Automated Test Generation](#automated-test-generation)
8. [CI/CD Integration](#cicd-integration)

## 🧪 Test Frameworks

### Jest
- Primary unit testing framework
- Already configured for Next.js
- Coverage thresholds: 80%+ functions, 90%+ lines

### Vitest
- Fast alternative to Jest
- Better TypeScript support
- Useful for rapid development

### Playwright
- E2E testing across browsers
- Visual regression testing
- Mobile and desktop testing

## 🔬 Unit Testing

### Running Tests

```bash
# Run Jest tests
npm test

# Watch mode
npm run test:watch

# CI mode with coverage
npm run test:ci

# Run Vitest tests
npm run test:vitest

# Vitest with coverage
npm run test:vitest:coverage
```

### Writing Unit Tests

Tests are located in `__tests__` directories or as `.test.tsx` files:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Test Coverage

View coverage reports:
- **HTML Report**: `coverage/index.html`
- **Terminal**: Displayed after test run

Target coverage:
- Functions: 80%
- Lines: 90%
- Branches: 25%
- Statements: 80%

## 🌐 E2E Testing

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium
```

### Available E2E Tests

- **Authentication Flow** (`auth.spec.ts`)
  - Sign in/sign up validation
  - OAuth flows
  - Session management
  - Security checks

- **Study Sessions** (`study-sessions.spec.ts`)
  - Session creation
  - Session management
  - Real-time updates
  - Performance checks

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    await page.goto('/path');
    await page.click('button');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

## 🔍 TypeScript Error Detection

### Running Type Checks

```bash
# One-time check
npm run typecheck

# Watch mode (continuous)
npm run typecheck:watch
```

### What It Detects

- Type mismatches
- Missing imports
- Invalid prop types
- Unused variables (with strict mode)

### Reports

- Real-time console output
- JSON reports in `reports/typescript-errors-*.json`
- Grouped by file and error code

## ⚡ Performance Monitoring

### Running Performance Tests

```bash
# Run performance tests
npm run performance

# Set new baseline
npm run performance:baseline
```

### Metrics Tracked

- **Load Time**: Total page load time
- **FCP**: First Contentful Paint
- **LCP**: Largest Contentful Paint
- **TTI**: Time to Interactive
- **CLS**: Cumulative Layout Shift

### Thresholds

- Load Time: < 3000ms
- FCP: < 1800ms
- LCP: < 2500ms
- TTI: < 3800ms
- CLS: < 0.1

### Regression Detection

The script compares current performance against baseline:
- 10% increase triggers warning
- Reports saved to `reports/performance-*.json`
- Baseline stored in `performance-baseline.json`

## 🔒 Security Scanning

### Running Security Scans

```bash
npm run security
```

### What It Checks

1. **Dependency Vulnerabilities**
   - Uses npm audit
   - Checks for known CVEs
   - Suggests updates

2. **Code Security Patterns**
   - Dangerous functions (eval, innerHTML)
   - XSS vulnerabilities
   - Credential exposure
   - Insecure storage

3. **Security Headers**
   - Content-Security-Policy
   - X-Frame-Options
   - Strict-Transport-Security
   - X-Content-Type-Options

4. **Environment Variables**
   - Checks for exposed secrets
   - Validates .env.example

### Reports

- Console output with severity levels
- JSON reports in `reports/security-*.json`
- Fails CI if critical/high issues found

## 🤖 Automated Test Generation

### Generate Tests for Existing Components

```bash
# Scan and generate missing tests
npm run generate-tests:scan
```

### Watch Mode

```bash
# Auto-generate tests for new components
npm run generate-tests:watch
```

### What It Generates

1. **Component Tests**
   - Basic render tests
   - Props validation
   - Interaction tests
   - Accessibility tests

2. **E2E Tests for Pages**
   - Page load tests
   - Responsive tests
   - Navigation tests
   - Console error checks

### Test Templates

Generated tests include:
- Mock data based on prop names
- Common test scenarios
- TODO comments for custom tests

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: QA Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test:ci
      - run: npm run security
      - run: npx playwright install
      - run: npm run test:e2e
      - run: npm run performance
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: |
            coverage/
            reports/
            playwright-report/
```

### Pre-commit Hooks

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run typecheck
npm run test
```

## 📊 Reports and Artifacts

### Generated Reports

```
clerva-app/
├── coverage/              # Jest/Vitest coverage
├── reports/              # QA script reports
│   ├── typescript-errors-*.json
│   ├── performance-*.json
│   └── security-*.json
├── playwright-report/    # E2E test reports
└── performance-baseline.json  # Performance baseline
```

### Viewing Reports

```bash
# Jest coverage
open coverage/index.html

# Playwright report
npx playwright show-report

# Performance/Security reports
cat reports/performance-*.json | jq
```

## 🎯 Best Practices

### 1. Write Tests First (TDD)
- Define expected behavior
- Write failing test
- Implement feature
- Refactor

### 2. Test Coverage Goals
- Critical paths: 100%
- Business logic: 90%+
- UI components: 80%+
- Utils/helpers: 95%+

### 3. E2E Test Organization
- One feature per file
- Use page objects for complex flows
- Keep tests independent
- Clean up after tests

### 4. Performance Budget
- Monitor bundle size
- Set performance baselines
- Track regressions
- Optimize critical paths

### 5. Security First
- Run scans before deployment
- Fix critical issues immediately
- Update dependencies regularly
- Review security reports

## 🐛 Debugging

### Debug Jest Tests

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Debug Playwright Tests

```bash
# Debug mode
npx playwright test --debug

# Trace viewer
npx playwright show-trace trace.zip
```

### Debug TypeScript Errors

```bash
# Verbose output
tsc --noEmit --extendedDiagnostics
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

## 🆘 Troubleshooting

### Tests Timing Out
- Increase timeout in config
- Check for infinite loops
- Verify async operations

### Flaky E2E Tests
- Add explicit waits
- Use `waitForLoadState`
- Check for race conditions

### Coverage Not Accurate
- Verify test file patterns
- Check exclude patterns
- Ensure test files run

### Performance Tests Fail
- Check if dev server is running
- Verify network conditions
- Review baseline values

## 🎉 Summary

You now have a complete QA testing infrastructure:

✅ **Unit Testing** with Jest and Vitest  
✅ **E2E Testing** with Playwright  
✅ **TypeScript Error Detection** with automated monitoring  
✅ **Performance Testing** with regression detection  
✅ **Security Scanning** for vulnerabilities  
✅ **Automated Test Generation** for new components  

Run `npm run qa:full` to execute the complete test suite!
