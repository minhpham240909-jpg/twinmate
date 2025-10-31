#!/usr/bin/env ts-node

/**
 * Security Vulnerability Scanner
 * Scans for common security issues and vulnerabilities
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
}

interface SecurityReport {
  timestamp: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: SecurityIssue[];
  dependencies: {
    vulnerable: number;
    total: number;
  };
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function checkDependencyVulnerabilities(): Promise<SecurityIssue[]> {
  return new Promise((resolve) => {
    log('\n🔍 Checking npm dependencies for vulnerabilities...', 'blue');
    
    const npm = spawn('npm', ['audit', '--json'], {
      cwd: process.cwd(),
      shell: true,
    });
    
    let output = '';
    
    npm.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    npm.on('close', () => {
      try {
        const auditData = JSON.parse(output);
        const issues: SecurityIssue[] = [];
        
        if (auditData.vulnerabilities) {
          for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities as any)) {
            const v = vuln as any;
            issues.push({
              severity: v.severity,
              type: 'dependency_vulnerability',
              description: `Vulnerable package: ${pkg} (${v.via?.[0]?.title || 'Unknown vulnerability'})`,
              recommendation: `Update to version ${v.fixAvailable?.version || 'latest'} or higher`,
            });
          }
        }
        
        resolve(issues);
      } catch (error) {
        log('Warning: Could not parse npm audit output', 'yellow');
        resolve([]);
      }
    });
  });
}

async function checkCodeSecurityPatterns(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  log('\n🔍 Scanning code for security patterns...', 'blue');
  
  // Common security anti-patterns to check
  const patterns = [
    {
      regex: /eval\s*\(/g,
      severity: 'high' as const,
      type: 'dangerous_function',
      description: 'Use of eval() detected',
      recommendation: 'Avoid using eval() as it can execute arbitrary code',
    },
    {
      regex: /dangerouslySetInnerHTML/g,
      severity: 'medium' as const,
      type: 'xss_risk',
      description: 'Use of dangerouslySetInnerHTML detected',
      recommendation: 'Sanitize HTML content to prevent XSS attacks',
    },
    {
      regex: /process\.env\.(API_KEY|SECRET|PASSWORD|TOKEN)/g,
      severity: 'medium' as const,
      type: 'credential_exposure',
      description: 'Potential credential exposure in code',
      recommendation: 'Use environment variables properly and never expose secrets client-side',
    },
    {
      regex: /localStorage\.setItem\([^,]+,\s*.*password.*\)/gi,
      severity: 'high' as const,
      type: 'insecure_storage',
      description: 'Storing sensitive data in localStorage',
      recommendation: 'Never store passwords or sensitive tokens in localStorage',
    },
    {
      regex: /innerHTML\s*=/g,
      severity: 'medium' as const,
      type: 'xss_risk',
      description: 'Direct innerHTML assignment detected',
      recommendation: 'Use textContent or sanitize HTML to prevent XSS',
    },
  ];
  
  // Scan TypeScript/JavaScript files
  const scanDir = (dir: string) => {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanDir(fullPath);
      } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        for (const pattern of patterns) {
          let match;
          while ((match = pattern.regex.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            
            issues.push({
              severity: pattern.severity,
              type: pattern.type,
              file: fullPath.replace(process.cwd(), '.'),
              line: lineNumber,
              description: pattern.description,
              recommendation: pattern.recommendation,
            });
          }
          // Reset regex state
          pattern.regex.lastIndex = 0;
        }
      }
    }
  };
  
  scanDir(path.join(process.cwd(), 'src'));
  
  return issues;
}

async function checkSecurityHeaders(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  log('\n🔍 Checking security headers configuration...', 'blue');
  
  const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
  
  if (fs.existsSync(nextConfigPath)) {
    const config = fs.readFileSync(nextConfigPath, 'utf-8');
    
    const requiredHeaders = [
      { name: 'X-Content-Type-Options', value: 'nosniff' },
      { name: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { name: 'Content-Security-Policy', value: null },
      { name: 'Strict-Transport-Security', value: null },
    ];
    
    for (const header of requiredHeaders) {
      if (!config.includes(header.name)) {
        issues.push({
          severity: 'medium',
          type: 'missing_security_header',
          file: 'next.config.ts',
          description: `Missing security header: ${header.name}`,
          recommendation: `Add ${header.name} header to Next.js configuration`,
        });
      }
    }
  }
  
  return issues;
}

async function checkEnvironmentVariables(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  log('\n🔍 Checking environment variable security...', 'blue');
  
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (fs.existsSync(envExamplePath)) {
    const envExample = fs.readFileSync(envExamplePath, 'utf-8');
    
    // Check for placeholder values that might be actual secrets
    const suspiciousPatterns = [
      /[A-Za-z0-9]{32,}/g, // Long alphanumeric strings
      /sk_[a-z]+_[A-Za-z0-9]+/g, // Stripe secret keys
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, // UUIDs
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(envExample)) {
        issues.push({
          severity: 'high',
          type: 'exposed_secret',
          file: '.env.example',
          description: 'Potential real secret in .env.example file',
          recommendation: 'Replace all real values with placeholders in .env.example',
        });
        break;
      }
    }
  }
  
  return issues;
}

function generateReport(report: SecurityReport): void {
  console.log('\n🔒 Security Scan Report\n');
  console.log('='.repeat(80));
  
  const { summary } = report;
  
  log(`\nSummary:`, 'blue');
  log(`  🔴 Critical: ${summary.critical}`, summary.critical > 0 ? 'red' : 'green');
  log(`  🟠 High: ${summary.high}`, summary.high > 0 ? 'red' : 'green');
  log(`  🟡 Medium: ${summary.medium}`, summary.medium > 0 ? 'yellow' : 'green');
  log(`  🟢 Low: ${summary.low}`, 'green');
  
  if (report.dependencies.vulnerable > 0) {
    log(`\n📦 Dependencies:`, 'blue');
    log(`  Vulnerable: ${report.dependencies.vulnerable}/${report.dependencies.total}`, 'yellow');
  }
  
  if (report.issues.length > 0) {
    log(`\n⚠️  Issues Found:\n`, 'yellow');
    
    // Group by severity
    const grouped = {
      critical: report.issues.filter(i => i.severity === 'critical'),
      high: report.issues.filter(i => i.severity === 'high'),
      medium: report.issues.filter(i => i.severity === 'medium'),
      low: report.issues.filter(i => i.severity === 'low'),
    };
    
    for (const [severity, issues] of Object.entries(grouped)) {
      if (issues.length > 0) {
        log(`${severity.toUpperCase()}:`, severity === 'critical' || severity === 'high' ? 'red' : 'yellow');
        for (const issue of issues) {
          console.log(`  ${issue.type} - ${issue.description}`);
          if (issue.file) {
            console.log(`    File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
          }
          console.log(`    💡 ${issue.recommendation}\n`);
        }
      }
    }
  } else {
    log('\n✅ No security issues detected!', 'green');
  }
  
  console.log('='.repeat(80));
}

async function runSecurityScan(): Promise<void> {
  log('🚀 Starting security scan...', 'blue');
  
  const allIssues: SecurityIssue[] = [];
  
  // Run all security checks
  const [depIssues, codeIssues, headerIssues, envIssues] = await Promise.all([
    checkDependencyVulnerabilities(),
    checkCodeSecurityPatterns(),
    checkSecurityHeaders(),
    checkEnvironmentVariables(),
  ]);
  
  allIssues.push(...depIssues, ...codeIssues, ...headerIssues, ...envIssues);
  
  // Generate report
  const summary = {
    critical: allIssues.filter(i => i.severity === 'critical').length,
    high: allIssues.filter(i => i.severity === 'high').length,
    medium: allIssues.filter(i => i.severity === 'medium').length,
    low: allIssues.filter(i => i.severity === 'low').length,
  };
  
  const report: SecurityReport = {
    timestamp: new Date().toISOString(),
    summary,
    issues: allIssues,
    dependencies: {
      vulnerable: depIssues.length,
      total: 0, // Would need to parse package.json
    },
  };
  
  generateReport(report);
  
  // Save report
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, `security-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`\n📄 Full report saved to: ${reportPath}`, 'blue');
  
  // Exit with error if critical or high severity issues found
  if (summary.critical > 0 || summary.high > 0) {
    process.exit(1);
  }
}

runSecurityScan().catch(console.error);
