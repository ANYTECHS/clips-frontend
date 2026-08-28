# Performance Regression Testing

We use Lighthouse CI to capture performance baselines and fail when regressions occur.

- To run locally: ensure the app is running on `http://localhost:3000` then run `npm run perf:test`.
- Baseline is stored in `performance/baseline.json`.
- Compare latest to baseline: `node scripts/perf-compare.js`.

CI should run Lighthouse autorun and then compare produced artifacts with baseline; this repository includes a small comparator at `scripts/perf-compare.js`.
