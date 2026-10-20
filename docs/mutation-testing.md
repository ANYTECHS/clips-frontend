# Mutation Testing (Stryker)

We use Stryker to run mutation testing and measure how effective our tests are.

- Run locally: `npm run mutation`
- HTML and JSON results are written to `reports/mutation/`.
- The targeted modules are auth, wallet storage, upload validation, and sanitization.
- Mutation scores below 70% fail the scheduled workflow (see `stryker.conf.js`).
- The nightly workflow records the measured score and commit in the uploaded
	`baseline-history.json` artifact. `mutation-baseline.json` remains unmeasured
	until the first scheduled run; do not substitute the threshold for a measured score.

Review surviving mutants in the HTML report. Add assertions for unintended
survivors and document intentional survivors with the affected module and reason.
