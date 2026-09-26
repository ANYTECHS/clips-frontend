# Deployment Runbook

This runbook covers the production deployment configured by [`fly.toml`](../fly.toml), using the Docker image in [`deploy/Dockerfile`](../deploy/Dockerfile). Kubernetes manifests are available under [`deploy/k8s/`](../deploy/k8s/), and [`vercel.json`](../vercel.json) contains separate Vercel settings; neither is the release procedure described here.

## Environments and prerequisites

- Use a staging environment first when available. Keep its OAuth, storage, Redis, AI backend, database, Sentry, and Stellar settings separate from production.
- Use Node.js 20 LTS and npm, matching the container and CI setup. Install dependencies with `npm ci`.
- A release operator needs repository access, a green CI run, Fly.io access to the `clipcash-frontend` app, and access to the production secrets and dependent services.
- Database releases additionally need PostgreSQL client tools (`pg_dump`) and authorized access to the production database.
- Configure OAuth callback URLs and service allowlists for the exact public origin before sending traffic to a new environment.

The complete required/optional status and security notes for variables are in [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md); `.env.example` is the variable template. Set server-side secrets with Fly's secret store, never in source control or image build arguments:

```sh
fly secrets set NAME=value ANOTHER_NAME=value
fly secrets list
```

At minimum, configure every variable marked **Always** or **Prod** in the environment reference, plus credentials for each enabled integration. In particular, production needs valid authentication/OAuth settings, AI backend URL and callback secret, private object-storage credentials, Redis, cron and metrics tokens, and the Sentry DSN. Configure `NEXTAUTH_URL` to the canonical HTTPS origin. Keep `NEXT_PUBLIC_STELLAR_NETWORK` on `testnet` until mainnet use is explicitly approved.

`NEXT_PUBLIC_*` variables are public and are compiled into client bundles. The Dockerfile declares build arguments for `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_AI_API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_STELLAR_NETWORK`, and `NEXT_PUBLIC_CDN_URL`. Supply the environment-appropriate values to the image build; changing them requires building and deploying a new image. The Dockerfile defaults Stellar to `mainnet`, so explicitly pass `testnet` for staging. Never pass secrets as build arguments. Other build-time public settings must also be present in the build environment if the app consumes them; Fly runtime secrets do not change values already compiled into the client bundle.

## Release procedure

1. Confirm the target environment, current production version, approved change, and an on-call contact. Confirm dependent services and the rollback operator are available.
2. Confirm the change has passed CI, including formatting, migration checks, and a successful production build. Run the focused tests for the change as required by its risk. Do not deploy if the production build fails, even if a CI job reports success with that step marked non-blocking.
3. For database changes, review the migration and its `rollback.sql`, verify compatibility with both the new and currently deployed app, and take a production backup as described under [Database changes and rollback](#database-changes-and-rollback). Prefer additive, backward-compatible migrations.
4. Build and test the release in staging with the same runtime and public build-time settings intended for production. Exercise sign-in, readiness, uploads, job callbacks, and any changed feature.
5. Apply approved database migrations from the release runner or another trusted environment that has the release code, Prisma CLI, and production `DATABASE_URL`:

   ```sh
   npm ci
   npm run migrate:deploy
   ```

   Do not assume the production runtime image contains the Prisma CLI. Keep the database credential out of shell history and logs.
6. Deploy the application from the repository root. For a first deployment, create the configured Fly app if it does not already exist; for subsequent releases use:

    ```sh
    fly deploy --app clipcash-frontend \
       --build-arg NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" \
       --build-arg NEXT_PUBLIC_AI_API_URL="$NEXT_PUBLIC_AI_API_URL" \
       --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
       --build-arg NEXT_PUBLIC_ANALYTICS_PROVIDER="$NEXT_PUBLIC_ANALYTICS_PROVIDER" \
       --build-arg NEXT_PUBLIC_STELLAR_NETWORK="$NEXT_PUBLIC_STELLAR_NETWORK" \
       --build-arg NEXT_PUBLIC_CDN_URL="$NEXT_PUBLIC_CDN_URL"
    ```

    Export the intended public values in the release environment before running this command; verify each value, especially the Stellar network, before building. Review the resulting image and release version in Fly before proceeding.
7. Watch the health checks and application logs during rollout. Run the [post-deployment checks](#post-deployment-checklist) before declaring the release complete.
8. Record the commit, Fly release version, migration names, backup location, verification results, and any follow-up in the release log or incident channel.

## Checklists

### Before deployment

- [ ] Correct environment and canonical URL confirmed; staging tested.
- [ ] CI and production build passed; change-specific tests passed.
- [ ] Required runtime secrets and public build-time values are set for this environment.
- [ ] OAuth providers, AI backend, storage, Redis, database, and cron integration are reachable and configured for this origin.
- [ ] Migration is reviewed for forward and backward compatibility; production backup is complete if the schema will change.
- [ ] Current Fly release and rollback operator are known; no conflicting release is in progress.
- [ ] Monitoring dashboards and alert notifications are available to the operator.

### Post-deployment

- [ ] `fly status --app clipcash-frontend` shows the expected app and running machines.
- [ ] `fly checks list --app clipcash-frontend` reports passing checks.
- [ ] Liveness and readiness endpoints return HTTP 200 and readiness reports no critical dependency as down.
- [ ] Sign-in works with a configured production provider.
- [ ] A controlled upload reaches storage and the AI backend can report job completion through the callback.
- [ ] Cron tasks execute successfully; inspect logs for failed requeue and cleanup runs.
- [ ] Sentry receives a production event/release and alerts route to the on-call channel.
- [ ] Metrics scraping succeeds with authentication; no secrets or personal data are exposed in logs or dashboards.
- [ ] Error rate, latency, resource use, and job queue are stable against the pre-release baseline.

## Health and monitoring

Use the configured public origin for these probes:

```sh
curl -fsS https://<app-host>/api/health
curl -fsS https://<app-host>/api/health/ready
curl -fsS -H "Authorization: Bearer $METRICS_TOKEN" https://<app-host>/api/metrics
```

`/api/health` is a liveness check and does not test dependencies. `/api/health/ready` checks Redis, the AI backend, and storage; HTTP 503 means a critical dependency is down. Both are unauthenticated and intended for uptime checks. Do not interpret liveness alone as proof that the service can process work.

The Fly configuration declares checks for both health endpoints and a Prometheus scrape at `/api/metrics`. That metrics route requires `METRICS_TOKEN` in production. Verify that the configured scraper can send the bearer token and that samples arrive; do not remove endpoint authentication to make a scrape pass. For a Prometheus Operator deployment, the existing ServiceMonitor shows the bearer-token scrape configuration. The metrics endpoint exposes job counts, process memory/uptime, and circuit-breaker state.

Sentry captures server and client errors and performance data when `NEXT_PUBLIC_SENTRY_DSN` is configured. Tag events with the correct environment and release. In the Sentry organization, ensure issue alerts route to the on-call channel; create or verify the performance dashboard and alert described in [`performance-monitoring.md`](performance-monitoring.md). Application logs are available with:

```sh
fly logs --app clipcash-frontend
```

Check Fly machine health and platform metrics alongside Sentry, dependency dashboards, and job queue metrics. Alert on sustained readiness failures, elevated server errors, growing failed/stalled jobs, unavailable dependencies, and resource saturation. Keep `METRICS_TOKEN` restricted to the metrics scraper and operators.

## Rollback and incident procedure

1. **Triage:** pause further deploys, identify the affected release and user impact, check Fly health checks and logs, readiness dependencies, Sentry, and job/metrics trends. Note whether a database migration or secret/configuration change was applied.
2. **Mitigate:** if the application release is the cause and the previous app version is compatible with the current schema, list releases and roll back the app:

   ```sh
   fly releases --app clipcash-frontend
   fly rollback <previous-version> --app clipcash-frontend
   ```

   Follow the Fly CLI's confirmation and inspect the newly created release. A code rollback does not revert database changes or restore previous secrets.
3. **Verify:** repeat the post-deployment checks, confirm the error rate and queue recover, and test the impacted workflow. Keep the incident open if readiness or processing remains degraded.
4. **Escalate data changes separately:** do not automatically reverse a migration. Prefer a forward fix when the new schema contains live data or the old application can tolerate it. If reversal is required, follow the database procedure below with the database owner and a verified backup.
5. **Communicate and record:** notify affected stakeholders, record the versions and actions taken, and preserve logs and relevant Sentry events for follow-up.

### Database changes and rollback

Follow [`MIGRATIONS.md`](MIGRATIONS.md). Before a production migration or rollback, take and verify a PostgreSQL custom-format backup using a secure production `DATABASE_URL`:

```sh
npm ci
npm run migrate:test
npm run migrate:backup
```

The backup script writes to `backups/database/`; store the resulting file in the approved protected backup location and confirm it is restorable before making a high-risk change. The `pg_dump` client must be installed. Do not commit backups or expose the database URL in logs.

Each migration must have a reviewed `rollback.sql`. Run `npm run migrate:rollback -- <migration-directory>` only after confirming the migration is applied, taking a fresh backup, checking the rollback against the current data, and coordinating with the database owner. This executes the SQL and marks the migration rolled back in Prisma history; it is not a general-purpose restore. Restoring a full backup is a separate, potentially data-losing recovery operation and requires an explicit recovery decision, maintenance plan, and restore verification. Prefer a forward corrective migration when that is safer.

## Operational reference

- Fly app configuration, regions, health checks, autoscaling, cron, and metrics: [`fly.toml`](../fly.toml)
- Runtime image and build-time public arguments: [`deploy/Dockerfile`](../deploy/Dockerfile)
- Environment variable requirements and secret handling: [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md)
- Migration and backup commands: [`MIGRATIONS.md`](MIGRATIONS.md)
- Kubernetes monitoring example: [`deploy/k8s/servicemonitor.yaml`](../deploy/k8s/servicemonitor.yaml)
- Scaling and cron alternatives: [`SCALING.md`](../SCALING.md)