const fs = require('fs');
const path = require('path');

// Simple comparator for Lighthouse JSON artifacts. Expects two files: baseline.json and latest.json
const baselinePath = path.resolve(process.cwd(), 'performance', 'baseline.json');
const latestPath = path.resolve(process.cwd(), 'performance', 'latest.json');

function load(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const baseline = load(baselinePath);
const latest = load(latestPath);

if (!baseline || !latest) {
  console.error('Missing baseline or latest report. Run LHCI to produce reports at performance/{baseline|latest}.json');
  process.exit(2);
}

function score(report) {
  return report.categories && report.categories.performance && report.categories.performance.score || 0;
}

const baseScore = score(baseline);
const newScore = score(latest);

console.log(`Baseline performance score: ${baseScore}`);
console.log(`Latest performance score:   ${newScore}`);

if (newScore < baseScore - 0.02) {
  console.error('Performance regression detected: score dropped more than 0.02');
  process.exit(1);
}
console.log('No significant performance regression detected.');
process.exit(0);
