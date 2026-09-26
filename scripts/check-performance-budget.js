#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const gzip = require('zlib').gzipSync;

const PERFORMANCE_BUDGET_FILE = path.join(__dirname, '../next.performance.json');
const NEXT_BUILD_DIR = path.join(__dirname, '../.next');

try {
  const budgetConfig = JSON.parse(fs.readFileSync(PERFORMANCE_BUDGET_FILE, 'utf-8'));
  
  if (!fs.existsSync(path.join(NEXT_BUILD_DIR, 'static'))) {
    console.warn('⚠️  .next/static directory not found. Run `npm run build` first.');
    process.exit(0);
  }

  let allWithinBudget = true;
  const results = [];

  // Check bundle sizes
  console.log('\n📦 Bundle Size Budget Check:\n');

  budgetConfig.bundles.forEach(bundle => {
    const bundlePattern = bundle.name;
    const staticDir = path.join(NEXT_BUILD_DIR, 'static', 'chunks');
    
    if (!fs.existsSync(staticDir)) {
      console.log(`⚠️  ${bundlePattern}: No chunks found`);
      return;
    }

    let totalSize = 0;
    const files = fs.readdirSync(staticDir);
    
    files.forEach(file => {
      if (file.includes(bundlePattern) && file.endsWith('.js')) {
        const filePath = path.join(staticDir, file);
        const content = fs.readFileSync(filePath);
        const gzipped = gzip(content);
        totalSize = Math.max(totalSize, gzipped.length);
      }
    });

    const maxSizeBytes = parseFloat(bundle.maxSize) * 1024;
    const percentage = ((totalSize / maxSizeBytes) * 100).toFixed(2);
    const status = totalSize > maxSizeBytes ? '❌' : '✅';
    
    if (totalSize > maxSizeBytes) {
      allWithinBudget = false;
    }

    const sizeKb = (totalSize / 1024).toFixed(2);
    results.push({
      name: bundle.name,
      actual: sizeKb,
      max: bundle.maxSize,
      percentage,
      status
    });

    console.log(`${status} ${bundle.name}: ${sizeKb}kb / ${bundle.maxSize} (${percentage}%)`);
  });

  console.log('\n' + (allWithinBudget ? '✅ All bundles within budget!' : '❌ Some bundles exceeded budget!'));

  if (!allWithinBudget) {
    console.log('\nTo debug, run: npm run analyze');
    process.exit(1);
  }

} catch (error) {
  console.error('Error checking performance budget:', error.message);
  process.exit(1);
}
