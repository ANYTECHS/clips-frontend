# Mutation Testing (Stryker)

We use Stryker to run mutation testing and measure how effective our tests are.

- Run locally: `npm run mutation`
- Results are written to `reports/mutation/html` (Stryker's HTML report).
- Target mutation score: 80%+ (see `stryker.conf.js` thresholds).

Action items after running Stryker:
- Fix weak tests that allow mutants to survive.
- Add focused unit tests for uncovered logic.
