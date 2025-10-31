#!/usr/bin/env ts-node

/**
 * Performance Monitoring and Regression Detection Script
 * Measures key performance metrics and compares against baselines
 */

import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceMetrics {
  url: string;
  timestamp: string;
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  memoryUsage?: number;
  bundleSize?: {
    js: number;
    css: number;
    total: number;
  };
}

interface PerformanceReport {
  timestamp: string;
  routes: PerformanceMetrics[];
  regressions: Array<{
    route: string;
    metric: string;
    current: number;
    baseline: number;
    percentageIncrease: number;
  }>;
}

const ROUTES_TO_TEST = [
  '/',
  '/auth/signin',
  '/dashboard',
  '/study-sessions',
  '/chat',
  '/features/ai-agent',
];

const PERFORMANCE_THRESHOLDS = {
  loadTime: 3000, // 3 seconds
  firstContentfulPaint: 1800,
  largestContentfulPaint: 2500,
  timeToInteractive: 3800,
  totalBlockingTime: 300,
  cumulativeLayoutShift: 0.1,
};

async function measurePagePerformance(
  page: Page,
  url: string
): Promise<PerformanceMetrics> {
  const fullUrl = `http://localhost:3000${url}`;
  
  await page.goto(fullUrl, { waitUntil: 'networkidle' });
  
  // Get performance metrics
  const metrics = await page.evaluate(() => {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintMetrics = performance.getEntriesByType('paint');
    
    return {
      loadTime: perfData.loadEventEnd - perfData.fetchStart,
      firstContentfulPaint:
        paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime || 0,
      domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
      timeToInteractive: perfData.domInteractive - perfData.fetchStart,
    };
  });
  
  // Get Web Vitals
  const webVitals = await page.evaluate(() => {
    return new Promise<any>((resolve) => {
      const vitals: any = {};
      
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        vitals.largestContentfulPaint = entries[entries.length - 1].startTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // CLS
      let cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
          }
        }
        vitals.cumulativeLayoutShift = cls;
      }).observe({ entryTypes: ['layout-shift'] });
      
      setTimeout(() => resolve(vitals), 3000);
    });
  });
  
  return {
    url,
    timestamp: new Date().toISOString(),
    loadTime: metrics.loadTime,
    firstContentfulPaint: metrics.firstContentfulPaint,
    largestContentfulPaint: webVitals.largestContentfulPaint || 0,
    timeToInteractive: metrics.timeToInteractive,
    totalBlockingTime: 0, // Requires more sophisticated measurement
    cumulativeLayoutShift: webVitals.cumulativeLayoutShift || 0,
  };
}

function detectRegressions(
  current: PerformanceMetrics[],
  baseline: PerformanceMetrics[]
): PerformanceReport['regressions'] {
  const regressions: PerformanceReport['regressions'] = [];
  
  for (const currentMetric of current) {
    const baselineMetric = baseline.find(m => m.url === currentMetric.url);
    if (!baselineMetric) continue;
    
    // Check each metric for regression
    const metricsToCheck: (keyof PerformanceMetrics)[] = [
      'loadTime',
      'firstContentfulPaint',
      'largestContentfulPaint',
      'timeToInteractive',
      'cumulativeLayoutShift',
    ];
    
    for (const metric of metricsToCheck) {
      const currentValue = currentMetric[metric] as number;
      const baselineValue = baselineMetric[metric] as number;
      
      if (currentValue > baselineValue * 1.1) { // 10% regression threshold
        const percentageIncrease = ((currentValue - baselineValue) / baselineValue) * 100;
        
        regressions.push({
          route: currentMetric.url,
          metric,
          current: currentValue,
          baseline: baselineValue,
          percentageIncrease,
        });
      }
    }
  }
  
  return regressions;
}

function generateReport(
  metrics: PerformanceMetrics[],
  regressions: PerformanceReport['regressions']
): void {
  console.log('\n📊 Performance Report\n');
  console.log('='.repeat(80));
  
  for (const metric of metrics) {
    console.log(`\n🔗 Route: ${metric.url}`);
    console.log(`  Load Time: ${metric.loadTime.toFixed(0)}ms ${getStatus(metric.loadTime, PERFORMANCE_THRESHOLDS.loadTime)}`);
    console.log(`  FCP: ${metric.firstContentfulPaint.toFixed(0)}ms ${getStatus(metric.firstContentfulPaint, PERFORMANCE_THRESHOLDS.firstContentfulPaint)}`);
    console.log(`  LCP: ${metric.largestContentfulPaint.toFixed(0)}ms ${getStatus(metric.largestContentfulPaint, PERFORMANCE_THRESHOLDS.largestContentfulPaint)}`);
    console.log(`  TTI: ${metric.timeToInteractive.toFixed(0)}ms ${getStatus(metric.timeToInteractive, PERFORMANCE_THRESHOLDS.timeToInteractive)}`);
    console.log(`  CLS: ${metric.cumulativeLayoutShift.toFixed(3)} ${getStatus(metric.cumulativeLayoutShift, PERFORMANCE_THRESHOLDS.cumulativeLayoutShift)}`);
  }
  
  if (regressions.length > 0) {
    console.log('\n⚠️  Performance Regressions Detected:\n');
    for (const regression of regressions) {
      console.log(`  ${regression.route} - ${regression.metric}`);
      console.log(`    Current: ${regression.current.toFixed(0)}, Baseline: ${regression.baseline.toFixed(0)}`);
      console.log(`    Increase: ${regression.percentageIncrease.toFixed(1)}%\n`);
    }
  } else {
    console.log('\n✅ No performance regressions detected!');
  }
  
  console.log('\n' + '='.repeat(80));
}

function getStatus(value: number, threshold: number): string {
  return value <= threshold ? '✅' : '❌';
}

async function runPerformanceTests(): Promise<void> {
  console.log('🚀 Starting performance tests...\n');
  
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const metrics: PerformanceMetrics[] = [];
  
  for (const route of ROUTES_TO_TEST) {
    try {
      console.log(`Testing ${route}...`);
      const metric = await measurePagePerformance(page, route);
      metrics.push(metric);
    } catch (error) {
      console.error(`Error testing ${route}:`, error);
    }
  }
  
  await browser.close();
  
  // Load baseline if exists
  const baselinePath = path.join(process.cwd(), 'performance-baseline.json');
  let baseline: PerformanceMetrics[] = [];
  
  if (fs.existsSync(baselinePath)) {
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  }
  
  const regressions = baseline.length > 0 ? detectRegressions(metrics, baseline) : [];
  
  // Generate and display report
  generateReport(metrics, regressions);
  
  // Save results
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    routes: metrics,
    regressions,
  };
  
  const reportPath = path.join(reportsDir, `performance-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  // Save as baseline if flag is set
  if (process.argv.includes('--baseline')) {
    fs.writeFileSync(baselinePath, JSON.stringify(metrics, null, 2));
    console.log(`📌 Baseline saved to: ${baselinePath}`);
  }
  
  // Exit with error if regressions detected
  if (regressions.length > 0) {
    process.exit(1);
  }
}

runPerformanceTests().catch(console.error);
