#!/usr/bin/env ts-node

/**
 * TypeScript Error Detection and Monitoring Script
 * Continuously checks for TypeScript errors and reports them
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match pattern: file.ts(line,col): error TSxxxx: message
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
    
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }
  }
  
  return errors;
}

function groupErrorsByFile(errors: TypeScriptError[]): Map<string, TypeScriptError[]> {
  const grouped = new Map<string, TypeScriptError[]>();
  
  for (const error of errors) {
    if (!grouped.has(error.file)) {
      grouped.set(error.file, []);
    }
    grouped.get(error.file)!.push(error);
  }
  
  return grouped;
}

function generateReport(errors: TypeScriptError[]): void {
  if (errors.length === 0) {
    log('✓ No TypeScript errors found!', 'green');
    return;
  }
  
  log(`\n✗ Found ${errors.length} TypeScript error(s)\n`, 'red');
  
  const grouped = groupErrorsByFile(errors);
  
  for (const [file, fileErrors] of grouped) {
    log(`${file}:`, 'cyan');
    
    for (const error of fileErrors) {
      log(`  Line ${error.line}:${error.column} - ${error.code}`, 'yellow');
      log(`    ${error.message}`, 'reset');
    }
    
    console.log();
  }
  
  // Generate summary
  const errorCodes = new Map<string, number>();
  for (const error of errors) {
    errorCodes.set(error.code, (errorCodes.get(error.code) || 0) + 1);
  }
  
  log('Error Summary:', 'magenta');
  for (const [code, count] of errorCodes) {
    log(`  ${code}: ${count} occurrence(s)`, 'reset');
  }
}

function saveReport(errors: TypeScriptError[], outputPath: string): void {
  const report = {
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    errors: errors.map(e => ({
      file: e.file,
      line: e.line,
      column: e.column,
      code: e.code,
      message: e.message,
    })),
    summary: Array.from(groupErrorsByFile(errors).entries()).map(([file, errs]) => ({
      file,
      errorCount: errs.length,
    })),
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  log(`\nReport saved to: ${outputPath}`, 'blue');
}

async function checkTypes(watch = false): Promise<void> {
  log('Starting TypeScript type check...', 'blue');
  
  const args = ['--noEmit', '--pretty', 'false'];
  if (watch) {
    args.push('--watch');
  }
  
  const tsc = spawn('npx', ['tsc', ...args], {
    cwd: process.cwd(),
    shell: true,
  });
  
  let output = '';
  
  tsc.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  tsc.stderr.on('data', (data) => {
    output += data.toString();
  });
  
  tsc.on('close', (code) => {
    const errors = parseTypeScriptErrors(output);
    generateReport(errors);
    
    // Save report to file
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportPath = path.join(
      reportsDir,
      `typescript-errors-${Date.now()}.json`
    );
    saveReport(errors, reportPath);
    
    if (errors.length > 0) {
      process.exit(1);
    }
  });
}

// CLI
const args = process.argv.slice(2);
const watch = args.includes('--watch') || args.includes('-w');

checkTypes(watch);
