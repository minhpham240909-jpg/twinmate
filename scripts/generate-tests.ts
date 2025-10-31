#!/usr/bin/env ts-node

/**
 * Automated Test Generation Script
 * Watches for new components/routes and generates test templates
 */

import * as fs from 'fs';
import * as path from 'path';
import { watch } from 'fs';

interface ComponentInfo {
  name: string;
  path: string;
  type: 'component' | 'page' | 'api';
  isClientComponent: boolean;
  props?: string[];
}

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function extractComponentInfo(filePath: string, content: string): ComponentInfo | null {
  // Determine component type
  let type: ComponentInfo['type'] = 'component';
  if (filePath.includes('/app/') && filePath.endsWith('/page.tsx')) {
    type = 'page';
  } else if (filePath.includes('/api/') && filePath.endsWith('/route.ts')) {
    type = 'api';
  }
  
  // Check if it's a client component
  const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
  
  // Extract component name
  const fileName = path.basename(filePath, path.extname(filePath));
  const componentMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/);
  const name = componentMatch ? componentMatch[1] : fileName;
  
  // Extract props (basic detection)
  const propsMatch = content.match(/interface\s+\w+Props\s*{([^}]+)}/);
  let props: string[] = [];
  if (propsMatch) {
    props = propsMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .map(line => line.split(':')[0].trim());
  }
  
  return {
    name,
    path: filePath,
    type,
    isClientComponent,
    props,
  };
}

function generateComponentTest(info: ComponentInfo): string {
  const relativePath = info.path.replace(process.cwd(), '.');
  const testPath = relativePath.replace('/src/', '/').replace('.tsx', '').replace('.ts', '');
  
  return `import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ${info.name} from '${testPath}';

describe('${info.name}', () => {
  it('renders without crashing', () => {
    ${generateRenderCall(info)}
    
    // Add assertions based on your component's expected output
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
  
  ${generatePropsTests(info)}
  
  ${generateInteractionTests(info)}
  
  ${generateAccessibilityTests()}
});
`;
}

function generateRenderCall(info: ComponentInfo): string {
  if (info.props && info.props.length > 0) {
    const mockProps = info.props
      .map(prop => `${prop}: ${generateMockValue(prop)}`)
      .join(',\n      ');
    
    return `const mockProps = {
      ${mockProps}
    };
    
    render(<${info.name} {...mockProps} />);`;
  }
  
  return `render(<${info.name} />);`;
}

function generateMockValue(propName: string): string {
  const lowerProp = propName.toLowerCase();
  
  if (lowerProp.includes('id')) return "'test-id-123'";
  if (lowerProp.includes('name')) return "'Test Name'";
  if (lowerProp.includes('title')) return "'Test Title'";
  if (lowerProp.includes('description')) return "'Test Description'";
  if (lowerProp.includes('email')) return "'test@example.com'";
  if (lowerProp.includes('url')) return "'https://example.com'";
  if (lowerProp.includes('count') || lowerProp.includes('number')) return '42';
  if (lowerProp.includes('is') || lowerProp.includes('has')) return 'true';
  if (lowerProp.includes('on') && lowerProp !== 'on') return 'vi.fn()';
  if (lowerProp.includes('callback') || lowerProp.includes('handler')) return 'vi.fn()';
  if (lowerProp.includes('children')) return '<div>Test Children</div>';
  if (lowerProp.includes('data') || lowerProp.includes('items')) return '[]';
  
  return "''";
}

function generatePropsTests(info: ComponentInfo): string {
  if (!info.props || info.props.length === 0) return '';
  
  return `it('handles props correctly', () => {
    // Test with different prop values
    // TODO: Add specific prop tests
  });`;
}

function generateInteractionTests(info: ComponentInfo): string {
  if (!info.isClientComponent) return '';
  
  return `
  it('handles user interactions', () => {
    ${generateRenderCall(info)}
    
    // TODO: Add interaction tests (clicks, inputs, etc.)
    // Example:
    // const button = screen.getByRole('button', { name: /submit/i });
    // fireEvent.click(button);
    // expect(mockHandler).toHaveBeenCalled();
  });`;
}

function generateAccessibilityTests(): string {
  return `
  it('meets accessibility standards', () => {
    // TODO: Add accessibility tests
    // Consider using @axe-core/react or similar
  });`;
}

function generateE2ETest(info: ComponentInfo): string {
  if (info.type !== 'page') return '';
  
  const routePath = info.path
    .replace(/.*\/app/, '')
    .replace('/page.tsx', '')
    .replace(/\[(\w+)\]/g, ':$1') || '/';
  
  return `import { test, expect } from '@playwright/test';

test.describe('${routePath}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('${routePath}');
  });
  
  test('page loads successfully', async ({ page }) => {
    await expect(page).toHaveURL(/${routePath.replace('/', '\\/')}/);
    
    // Check for main content
    const mainContent = page.locator('main, [role="main"]');
    await expect(mainContent).toBeVisible();
  });
  
  test('displays correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });
  
  test('is responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('main')).toBeVisible();
  });
  
  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.reload();
    expect(errors).toHaveLength(0);
  });
  
  // TODO: Add more E2E tests specific to this page
});
`;
}

function generateTestFile(info: ComponentInfo): void {
  let testContent: string;
  let testFilePath: string;
  
  if (info.type === 'page') {
    // Generate E2E test
    testContent = generateE2ETest(info);
    const routeName = info.path
      .replace(/.*\/app/, '')
      .replace('/page.tsx', '')
      .replace(/\[(\w+)\]/g, '$1')
      .replace(/\//g, '-')
      .replace(/^-/, '') || 'home';
    
    testFilePath = path.join(process.cwd(), 'tests', 'e2e', `${routeName}.spec.ts`);
  } else if (info.type === 'api') {
    log(`Skipping API route: ${info.path}`, 'yellow');
    return;
  } else {
    // Generate unit test
    testContent = generateComponentTest(info);
    const componentDir = path.dirname(info.path);
    const testDir = path.join(componentDir, '__tests__');
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    testFilePath = path.join(testDir, `${info.name}.test.tsx`);
  }
  
  // Check if test already exists
  if (fs.existsSync(testFilePath)) {
    log(`Test already exists: ${testFilePath}`, 'yellow');
    return;
  }
  
  // Write test file
  fs.writeFileSync(testFilePath, testContent);
  log(`✓ Generated test: ${testFilePath}`, 'green');
}

function scanAndGenerateTests(directory: string): void {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip certain directories
      if (
        file === 'node_modules' ||
        file === '.next' ||
        file === '__tests__' ||
        file.startsWith('.')
      ) {
        continue;
      }
      
      scanAndGenerateTests(fullPath);
    } else if (file.match(/\.(tsx|ts)$/) && !file.endsWith('.test.tsx') && !file.endsWith('.spec.ts')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Check if it's a React component or Next.js page
      if (
        content.includes('export default') &&
        (content.includes('React') || content.includes('function') || content.includes('const'))
      ) {
        const info = extractComponentInfo(fullPath, content);
        if (info) {
          generateTestFile(info);
        }
      }
    }
  }
}

function watchForNewFiles(): void {
  log('👀 Watching for new components and routes...', 'blue');
  
  const srcDir = path.join(process.cwd(), 'src');
  
  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    const fullPath = path.join(srcDir, filename);
    
    // Check if it's a new TypeScript/TSX file
    if (
      eventType === 'rename' &&
      filename.match(/\.(tsx|ts)$/) &&
      !filename.includes('__tests__') &&
      !filename.endsWith('.test.tsx') &&
      !filename.endsWith('.spec.ts')
    ) {
      // Wait a bit for file to be fully written
      setTimeout(() => {
        if (fs.existsSync(fullPath)) {
          log(`\n📝 New file detected: ${filename}`, 'blue');
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          if (
            content.includes('export default') &&
            (content.includes('React') || content.includes('function') || content.includes('const'))
          ) {
            const info = extractComponentInfo(fullPath, content);
            if (info) {
              generateTestFile(info);
            }
          }
        }
      }, 500);
    }
  });
  
  log('✓ Watching started. Press Ctrl+C to stop.', 'green');
  
  // Keep process alive
  process.on('SIGINT', () => {
    log('\nStopping watcher...', 'yellow');
    watcher.close();
    process.exit(0);
  });
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--watch') || args.includes('-w')) {
  watchForNewFiles();
} else if (args.includes('--scan')) {
  log('🔍 Scanning for components without tests...', 'blue');
  scanAndGenerateTests(path.join(process.cwd(), 'src'));
  log('\n✓ Scan complete!', 'green');
} else {
  console.log(`
Usage:
  npm run generate-tests -- --scan    Scan existing components and generate missing tests
  npm run generate-tests -- --watch   Watch for new components and auto-generate tests
`);
}
